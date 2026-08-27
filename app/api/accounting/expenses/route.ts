/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { retryableTransaction } from '@/lib/prisma-transaction';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { payee, date, description, items, totalAmount, cashAccountId, subsidiaryLedgerId, isVatInclusive, noInputVat, ewtAccountId, ewtPercentage, netAmount, vatAmount, ewtAmount, branchId } = body;

    if (!payee || !items || items.length === 0 || !cashAccountId) {
      return NextResponse.json({ error: 'Missing required fields: payee, items, or cash account' }, { status: 400 });
    }

    const expenseNumber = `EXP-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const itemTotal = items.reduce((sum: number, item: any) => sum + (item.amount || 0), 0);
    const computedNet = isVatInclusive ? itemTotal / 1.12 : itemTotal;
    const computedVat = isVatInclusive ? itemTotal - computedNet : itemTotal * 0.12;
    const ewtPercent = parseFloat(ewtPercentage) || 0;
    const computedEwt = computedNet * (ewtPercent / 100);
    const finalTotal = computedNet + computedVat;

    const result = await retryableTransaction(async (tx) => {
      const expense = await tx.expense.create({
        data: {
          expenseNumber,
          date: new Date(date),
          payee,
          description,
          status: 'PENDING',
          totalAmount: finalTotal,
          branchId: branchId || undefined,
          items: {
            create: items.map((item: any) => ({
              description: item.description,
              amount: item.amount,
              accountId: item.accountId,
            }))
          }
        }
      });

      // Collect all journal lines upfront
      const journalLinesData = items.map((item: any) => ({
        accountId: item.accountId,
        debit: item.amount,
        credit: 0,
        memo: `Expense ${expenseNumber}: ${item.description}`,
      }));

      if (computedVat > 0 && !noInputVat) {
        const inputVATAccount = await tx.account.findFirst({
          where: { code: '2320' },
        });
        if (inputVATAccount) {
          journalLinesData.push({
            accountId: inputVATAccount.id,
            debit: computedVat,
            credit: 0,
            memo: `Expense ${expenseNumber} Input VAT`,
          });
        }
      }

      if (ewtPercent > 0 && ewtAccountId) {
        journalLinesData.push({
          accountId: ewtAccountId,
          debit: 0,
          credit: computedEwt,
          memo: `Expense ${expenseNumber} EWT`,
        });
      }

      journalLinesData.push({
        accountId: cashAccountId,
        subsidiaryLedgerId: subsidiaryLedgerId || undefined,
        debit: 0,
        credit: finalTotal - computedEwt,
        memo: `Payment for ${expenseNumber}`,
      });

      const journalEntry = await tx.journalEntry.create({
        data: {
          date: new Date(date),
          description: `Expense ${expenseNumber} - ${payee}${description ? ` - ${description}` : ''}`,
          reference: expenseNumber,
          branchId: branchId || undefined,
          lines: {
            create: journalLinesData,
          },
        },
      });

      await tx.expense.update({
        where: { id: expense.id },
        data: { journalEntryId: journalEntry.id }
      });

      // Create SubsidiaryTransaction if vendor/subsidiary is linked (mirrors purchases pattern)
      // If AP account selected but no subsidiary picked, auto-create vendor from payee name
      let resolvedSubsidiaryLedgerId = subsidiaryLedgerId || undefined;
      if (!resolvedSubsidiaryLedgerId && payee) {
        const selectedAccount = await tx.account.findUnique({ where: { id: cashAccountId } });
        const isAPAccount = selectedAccount?.type === 'LIABILITY' && selectedAccount?.code.startsWith('21');
        if (isAPAccount) {
          // Find or auto-create vendor
          let vendor = await tx.subsidiaryLedger.findFirst({
            where: { entityType: 'SUPPLIER', entityName: payee, accountId: cashAccountId },
          });
          if (!vendor) {
            // Auto-generate vendor code
            const existingVendors = await tx.subsidiaryLedger.findMany({
              where: { entityType: 'SUPPLIER', entityCode: { startsWith: 'SUP-' } },
              select: { entityCode: true },
              orderBy: { entityCode: 'desc' },
            });
            let maxNum = 0;
            for (const v of existingVendors) {
              const match = v.entityCode?.match(/^SUP-(\d+)$/);
              if (match) {
                const num = parseInt(match[1], 10);
                if (num > maxNum) maxNum = num;
              }
            }
            vendor = await tx.subsidiaryLedger.create({
              data: {
                accountId: cashAccountId,
                entityCode: `SUP-${String(maxNum + 1).padStart(4, '0')}`,
                entityName: payee,
                entityType: 'SUPPLIER',
                description: `Auto-created from Expense ${expenseNumber}`,
                branchId: branchId || undefined,
              },
            });
          }
          resolvedSubsidiaryLedgerId = vendor.id;
        }
      }

      if (resolvedSubsidiaryLedgerId) {
        const ledger = await tx.subsidiaryLedger.findUnique({ where: { id: resolvedSubsidiaryLedgerId } });
        if (ledger) {
          await tx.subsidiaryTransaction.create({
            data: {
              ledgerId: resolvedSubsidiaryLedgerId,
              date: new Date(date),
              referenceNo: expenseNumber,
              description: `Expense ${expenseNumber} - ${payee}`,
              debit: 0,
              credit: finalTotal - computedEwt,
              journalEntryId: journalEntry.id,
            },
          });
          // Recalculate vendor totals
          const ledgerTxs = await tx.subsidiaryTransaction.findMany({ where: { ledgerId: resolvedSubsidiaryLedgerId } });
          const debitTotal = ledgerTxs.reduce((sum: number, t: any) => sum + t.debit, 0);
          const creditTotal = ledgerTxs.reduce((sum: number, t: any) => sum + t.credit, 0);
          await tx.subsidiaryLedger.update({
            where: { id: resolvedSubsidiaryLedgerId },
            data: { debitTotal, creditTotal, balance: debitTotal - creditTotal },
          });
        }
      }

      return { expense, journalEntry };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error creating expense:', error);
    return NextResponse.json({ error: 'Failed to create expense' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const status = searchParams.get('status');
    const branchId = searchParams.get('branchId');

    const where: any = {};
    if (search) {
      where.OR = [
        { payee: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { expenseNumber: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (status) {
      where.status = status;
    }
    if (branchId) {
      where.branchId = branchId;
    }

    const expenses = await prisma.expense.findMany({
      where,
      include: {
        items: true,
        journalEntry: {
          include: {
            lines: {
              include: { account: true, subsidiaryLedger: true },
              orderBy: { createdAt: 'asc' },
            },
          },
        },
      },
      orderBy: { date: 'desc' },
    });
    return NextResponse.json(expenses);
  } catch (error) {
    console.error('Error fetching expenses:', error);
    return NextResponse.json({ error: 'Failed to fetch expenses' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, status, payee, date, description, items, totalAmount, cashAccountId, subsidiaryLedgerId, isVatInclusive, noInputVat, ewtAccountId, ewtPercentage, netAmount, vatAmount, ewtAmount, branchId } = body;

    if (!id) {
      return NextResponse.json({ error: 'Expense ID is required' }, { status: 400 });
    }

    // Only status update - simple case
    if (status && !payee && !date && !items && !cashAccountId) {
      const result = await retryableTransaction(async (tx) => {
        const expense = await tx.expense.findUnique({
          where: { id },
          include: { items: true },
        });

        if (!expense) {
          throw new Error('Expense not found');
        }

        if (status === 'VOID' && expense.journalEntryId) {
          await tx.journalEntry.update({
            where: { id: expense.journalEntryId },
            data: { status: 'VOID' },
          });
        }

        const updatedExpense = await tx.expense.update({
          where: { id },
          data: { status },
        });

        return updatedExpense;
      });

      return NextResponse.json(result);
    }

    // Full expense update - needs to cascade to Journal Entry
    const result = await retryableTransaction(async (tx) => {
      const existingExpense = await tx.expense.findUnique({
        where: { id },
        include: { items: true },
      });

      if (!existingExpense) {
        throw new Error('Expense not found');
      }

      if (!items || items.length === 0) {
        throw new Error('Expense must have at least one item');
      }

      if (!cashAccountId) {
        throw new Error('Cash/bank account is required');
      }

      const itemTotal = items.reduce((sum: number, item: any) => sum + (item.amount || 0), 0);
      const computedNet = isVatInclusive ? itemTotal / 1.12 : itemTotal;
      const computedVat = isVatInclusive ? itemTotal - computedNet : itemTotal * 0.12;
      const ewtPercent = parseFloat(ewtPercentage) || 0;
      const computedEwt = computedNet * (ewtPercent / 100);
      const finalTotal = computedNet + computedVat;

      if (totalAmount !== undefined && Math.abs(itemTotal - totalAmount) > 0.01) {
        throw new Error('Total amount does not match sum of items');
      }

      // Find old subsidiary ledger ID before deleting (for recalculation)
      let oldSubsidiaryLedgerId: string | null = null;
      if (existingExpense.journalEntryId) {
        const oldApLine = await tx.journalLine.findFirst({
          where: { entryId: existingExpense.journalEntryId, subsidiaryLedgerId: { not: null } },
          select: { subsidiaryLedgerId: true },
        });
        oldSubsidiaryLedgerId = oldApLine?.subsidiaryLedgerId || null;

        // Delete old subsidiary transactions
        if (oldSubsidiaryLedgerId) {
          await tx.subsidiaryTransaction.deleteMany({
            where: { journalEntryId: existingExpense.journalEntryId },
          });
        }

        // Delete old journal entry (explicitly delete lines first - MongoDB cascade is unreliable)
        await tx.journalLine.deleteMany({
          where: { entryId: existingExpense.journalEntryId },
        });
        await tx.journalEntry.delete({
          where: { id: existingExpense.journalEntryId },
        });
      }

      // Collect all journal lines upfront to create in a single nested operation
      const journalLinesData = items.map((item: any) => ({
        accountId: item.accountId,
        debit: item.amount,
        credit: 0,
        memo: `Expense ${existingExpense.expenseNumber}: ${item.description}`,
      }));

      if (computedVat > 0 && !noInputVat) {
        const inputVATAccount = await tx.account.findFirst({
          where: { code: '2320' },
        });
        if (inputVATAccount) {
          journalLinesData.push({
            accountId: inputVATAccount.id,
            debit: computedVat,
            credit: 0,
            memo: `Expense ${existingExpense.expenseNumber} Input VAT`,
          });
        }
      }

      if (ewtPercent > 0 && ewtAccountId) {
        journalLinesData.push({
          accountId: ewtAccountId,
          debit: 0,
          credit: computedEwt,
          memo: `Expense ${existingExpense.expenseNumber} EWT`,
        });
      }

      journalLinesData.push({
        accountId: cashAccountId,
        subsidiaryLedgerId: subsidiaryLedgerId || undefined,
        debit: 0,
        credit: finalTotal - computedEwt,
        memo: `Payment for ${existingExpense.expenseNumber}`,
      });

      // Create journal entry with all lines in one query
      const journalEntry = await tx.journalEntry.create({
        data: {
          date: new Date(date || existingExpense.date),
          description: `Expense ${existingExpense.expenseNumber} - ${payee || existingExpense.payee}${description ? ` - ${description}` : existingExpense.description ? ` - ${existingExpense.description}` : ''}`,
          reference: existingExpense.expenseNumber,
          branchId: branchId || undefined,
          lines: {
            create: journalLinesData,
          },
        },
      });

      // Create SubsidiaryTransaction if vendor/subsidiary is linked (mirrors purchases pattern)
      // If AP account selected but no subsidiary picked, auto-create vendor from payee name
      const payeeName = payee || existingExpense.payee;
      let resolvedSubsidiaryLedgerId = subsidiaryLedgerId || undefined;
      if (!resolvedSubsidiaryLedgerId && payeeName) {
        const selectedAccount = await tx.account.findUnique({ where: { id: cashAccountId } });
        const isAPAccount = selectedAccount?.type === 'LIABILITY' && selectedAccount?.code.startsWith('21');
        if (isAPAccount) {
          let vendor = await tx.subsidiaryLedger.findFirst({
            where: { entityType: 'SUPPLIER', entityName: payeeName, accountId: cashAccountId },
          });
          if (!vendor) {
            const existingVendors = await tx.subsidiaryLedger.findMany({
              where: { entityType: 'SUPPLIER', entityCode: { startsWith: 'SUP-' } },
              select: { entityCode: true },
              orderBy: { entityCode: 'desc' },
            });
            let maxNum = 0;
            for (const v of existingVendors) {
              const match = v.entityCode?.match(/^SUP-(\d+)$/);
              if (match) {
                const num = parseInt(match[1], 10);
                if (num > maxNum) maxNum = num;
              }
            }
            vendor = await tx.subsidiaryLedger.create({
              data: {
                accountId: cashAccountId,
                entityCode: `SUP-${String(maxNum + 1).padStart(4, '0')}`,
                entityName: payeeName,
                entityType: 'SUPPLIER',
                description: `Auto-created from Expense ${existingExpense.expenseNumber}`,
                branchId: branchId || undefined,
              },
            });
          }
          resolvedSubsidiaryLedgerId = vendor.id;
        }
      }

      if (resolvedSubsidiaryLedgerId) {
        const ledger = await tx.subsidiaryLedger.findUnique({ where: { id: resolvedSubsidiaryLedgerId } });
        if (ledger) {
          await tx.subsidiaryTransaction.create({
            data: {
              ledgerId: resolvedSubsidiaryLedgerId,
              date: new Date(date || existingExpense.date),
              referenceNo: existingExpense.expenseNumber,
              description: `Expense ${existingExpense.expenseNumber} - ${payeeName}`,
              debit: 0,
              credit: finalTotal - computedEwt,
              journalEntryId: journalEntry.id,
            },
          });
          // Recalculate new vendor totals
          const ledgerTxs = await tx.subsidiaryTransaction.findMany({ where: { ledgerId: resolvedSubsidiaryLedgerId } });
          const debitTotal = ledgerTxs.reduce((sum: number, t: any) => sum + t.debit, 0);
          const creditTotal = ledgerTxs.reduce((sum: number, t: any) => sum + t.credit, 0);
          await tx.subsidiaryLedger.update({
            where: { id: resolvedSubsidiaryLedgerId },
            data: { debitTotal, creditTotal, balance: debitTotal - creditTotal },
          });
        }
      }

      // Recalculate old vendor balance if vendor changed
      if (oldSubsidiaryLedgerId && oldSubsidiaryLedgerId !== resolvedSubsidiaryLedgerId) {
        const oldLedgerTxs = await tx.subsidiaryTransaction.findMany({ where: { ledgerId: oldSubsidiaryLedgerId } });
        const debitTotal = oldLedgerTxs.reduce((sum: number, t: any) => sum + t.debit, 0);
        const creditTotal = oldLedgerTxs.reduce((sum: number, t: any) => sum + t.credit, 0);
        await tx.subsidiaryLedger.update({
          where: { id: oldSubsidiaryLedgerId },
          data: { debitTotal, creditTotal, balance: debitTotal - creditTotal },
        });
      }

      // Update expense with journal entry link and items in one query
      const updatedExpense = await tx.expense.update({
        where: { id },
        data: {
          ...(date && { date: new Date(date) }),
          ...(payee && { payee }),
          ...(description !== undefined && { description }),
          ...(branchId !== undefined && { branchId: branchId || null }),
          totalAmount: finalTotal,
          journalEntryId: journalEntry.id,
          items: {
            deleteMany: {},
            create: items.map((item: any) => ({
              description: item.description,
              amount: item.amount,
              accountId: item.accountId,
            })),
          },
        },
        include: { items: true },
      });

      return updatedExpense;
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error updating expense:', error);
    const message = error instanceof Error ? error.message : 'Failed to update expense';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Expense ID is required' }, { status: 400 });
    }

    const result = await retryableTransaction(async (tx) => {
      const expense = await tx.expense.findUnique({
        where: { id },
        include: { items: true },
      });

      if (!expense) {
        throw new Error('Expense not found');
      }

      // Delete the linked journal entry first (explicitly delete lines first - MongoDB cascade is unreliable).
      // ExpenseItem is also deleted automatically via onDelete: Cascade.
      if (expense.journalEntryId) {
        // Find subsidiary ledger before deleting transactions (for recalculation)
        const apLine = await tx.journalLine.findFirst({
          where: { entryId: expense.journalEntryId, subsidiaryLedgerId: { not: null } },
          select: { subsidiaryLedgerId: true },
        });
        const linkedLedgerId = apLine?.subsidiaryLedgerId || null;

        // Delete subsidiary transactions
        if (linkedLedgerId) {
          await tx.subsidiaryTransaction.deleteMany({
            where: { journalEntryId: expense.journalEntryId },
          });
        }

        await tx.journalLine.deleteMany({
          where: { entryId: expense.journalEntryId },
        });
        await tx.journalEntry.delete({
          where: { id: expense.journalEntryId },
        });

        // Recalculate vendor balance after deletion
        if (linkedLedgerId) {
          const ledgerTxs = await tx.subsidiaryTransaction.findMany({ where: { ledgerId: linkedLedgerId } });
          const debitTotal = ledgerTxs.reduce((sum: number, t: any) => sum + t.debit, 0);
          const creditTotal = ledgerTxs.reduce((sum: number, t: any) => sum + t.credit, 0);
          await tx.subsidiaryLedger.update({
            where: { id: linkedLedgerId },
            data: { debitTotal, creditTotal, balance: debitTotal - creditTotal },
          });
        }
      }

      // Delete the expense (cascades to ExpenseItem)
      const deletedExpense = await tx.expense.delete({
        where: { id },
      });

      return deletedExpense;
    });

    return NextResponse.json({ success: true, deleted: result });
  } catch (error) {
    console.error('Error deleting expense:', error);
    const message = error instanceof Error ? error.message : 'Failed to delete expense';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
