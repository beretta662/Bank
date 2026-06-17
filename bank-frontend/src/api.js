const BASE = 'http://localhost:3000'

export async function getAccounts() {
  const res = await fetch(`${BASE}/accounts`)
  if (!res.ok) throw new Error('Erreur getAccounts')
  return res.json()
}

export async function createAccount(payload) {
  const res = await fetch(`${BASE}/accounts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Erreur création compte')
  return data
}

export async function createTransaction(payload) {
  const res = await fetch(`${BASE}/transactions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Erreur transaction')
  return data
}

export async function getHistory(accountId) {
  const res = await fetch(`${BASE}/history/${accountId}`)
  if (!res.ok) throw new Error('Erreur getHistory')
  return res.json()
}
