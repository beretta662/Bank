import React, { useState } from 'react'
import { createAccount } from '../api'

export default function AccountForm({ onCreated }) {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState(null)

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)
    try {
      await createAccount({ firstName, lastName, email })
      setMessage({ type: 'success', text: 'Compte créé avec succès' })
      setFirstName('')
      setLastName('')
      setEmail('')
      if (onCreated) onCreated()
    } catch (err) {
      setMessage({ type: 'error', text: err.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={submit} className="card">
      <div className="field">
        <label>Prénom</label>
        <input value={firstName} onChange={e => setFirstName(e.target.value)} required />
      </div>
      <div className="field">
        <label>Nom</label>
        <input value={lastName} onChange={e => setLastName(e.target.value)} required />
      </div>
      <div className="field">
        <label>Email</label>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
      </div>
      <button type="submit" disabled={loading}>{loading ? 'Création...' : 'Créer'}</button>
      {message && <p className={message.type === 'error' ? 'err' : 'ok'}>{message.text}</p>}
    </form>
  )
}
