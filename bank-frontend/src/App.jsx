import React, { useEffect, useState } from 'react'
import { getAccounts } from './api'
import AccountForm from './components/AccountForm'
import AccountList from './components/AccountList'
import TransactionForm from './components/TransactionForm'

export default function App() {
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)

  const loadAccounts = async () => {
    setLoading(true)
    try {
      const data = await getAccounts()
      setAccounts(data)
    } catch (e) {
      console.error(e)
      setAccounts([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadAccounts() }, [])

  return (
    <div className="container">
      <h1>Bank - Frontend</h1>
      <div className="grid">
        <div>
          <h2>Créer un compte</h2>
          <AccountForm onCreated={loadAccounts} />
          <h2>Effectuer une transaction</h2>
          <TransactionForm accounts={accounts} onDone={loadAccounts} />
        </div>
        <div>
          <h2>Liste des comptes</h2>
          {loading ? <p>Chargement...</p> : <AccountList accounts={accounts} />}
        </div>
      </div>
    </div>
  )
}
