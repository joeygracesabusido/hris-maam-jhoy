import { useMemo } from 'react'
import { useAccounts, type Account } from './use-accounting'

export function useFilteredAccounts() {
  const { data: allAccounts = [], isLoading } = useAccounts()
  
  const filtered = useMemo(() => {
    // Expense accounts: EXPENSE type or special codes 2100/1200
    const expenseAccounts = allAccounts
      .filter((a: Account) => a.type === 'EXPENSE' || a.code === '2100' || a.code === '1200')
      .sort((a, b) => a.name.localeCompare(b.name))
    
    // Cash accounts: ASSET with cash/bank or LIABILITY starting with 21
    const cashAccounts = allAccounts
      .filter((a: Account) => 
        (a.type === 'ASSET' && 
         (a.name.toLowerCase().includes('cash') || 
          a.name.toLowerCase().includes('bank'))) ||
        (a.type === 'LIABILITY' && a.code.startsWith('21'))
      )
      .sort((a, b) => a.code.localeCompare(b.code))
    
    // EWT accounts: codes starting with 234
    const ewtAccounts = allAccounts
      .filter((a: Account) => a.code.startsWith('234'))
      .sort((a, b) => a.code.localeCompare(b.code))
    
    // Input VAT account: code 2320
    const inputVatAccount = allAccounts.find((a: Account) => a.code === '2320')
    
    return {
      allAccounts,
      expenseAccounts,
      cashAccounts,
      ewtAccounts,
      inputVatAccount
    }
  }, [allAccounts])
  
  return { ...filtered, isLoading }
}
