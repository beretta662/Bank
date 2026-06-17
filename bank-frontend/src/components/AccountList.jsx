import React from 'react'

export default function AccountList({ accounts }) {
  if (!accounts || accounts.length === 0) return <p>Aucun compte.</p>

  return (
    <div>
      <table className="table">
        <thead>
          <tr><th>ID</th><th>Nom</th><th>Email</th><th>Solde</th><th>Créé le</th></tr>
        </thead>
        <tbody>
          {accounts.map(a => (
            <tr key={a.id}>
              <td>{a.id}</td>
              <td>{a.firstName} {a.lastName}</td>
              <td>{a.email}</td>
              <td>{a.balance.toFixed(2)}</td>
              <td>{new Date(a.createdAt).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
