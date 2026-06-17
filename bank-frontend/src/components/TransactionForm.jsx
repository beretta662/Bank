import React, { useState } from 'react'
import { createTransaction } from '../api'

export default function TransactionForm({ accounts = [], onDone }) {
  const [accountId, setAccountId] = useState(accounts[0]?.id || '')
  const [amount, setAmount] = useState('')
  const [operation, setOperation] = useState('deposit')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState(null)

  // When accounts change, set default
  React.useEffect(() => { if (accounts[0]) setAccountId(accounts[0].id) }, [accounts])

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)
    try {
      await createTransaction({ accountId: parseInt(accountId), amount: Number(amount), operation })
      setMessage({ type: 'success', text: 'Transaction réussie' })
      setAmount('')
      if (onDone) onDone()
    } catch (err) {
      setMessage({ type: 'error', text: err.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={submit} className="card">
      <div className="field">
        <label>Compte</label>
        <select value={accountId} onChange={e => setAccountId(e.target.value)} required>
          {accounts.map(a => <option key={a.id} value={a.id}>{a.id} - {a.firstName} {a.lastName}</option>)}
        </select>
      </div>
      <div className="field">
        <label>Montant</label>
        <input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} required />
      </div>
      <div className="field">
        <label>Opération</label>
        <select value={operation} onChange={e => setOperation(e.target.value)}>
          <option value="deposit">Dépôt</option>
          <option value="withdraw">Retrait</option>
        </select>
      </div>
      <button type="submit" disabled={loading}>{loading ? 'En cours...' : 'Exécuter'}</button>
      {message && <p className={message.type === 'error' ? 'err' : 'ok'}>{message.text}</p>}
    </form>
  )
}
