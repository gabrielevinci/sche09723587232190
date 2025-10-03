'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

interface User {
  id: string
  name: string
  email: string
  isActive: boolean
  createdAt: string
  adminAssociations: {
    id: string
    socialAccount: {
      id: string
      platform: string
      accountName: string
    }
  }[]
}

interface SocialAccount {
  id: string
  platform: string
  accountName: string
  accountId: string
}

export default function AdminPage() {
  const { status } = useSession()
  const router = useRouter()
  
  const [users, setUsers] = useState<User[]>([])
  const [socialAccounts, setSocialAccounts] = useState<SocialAccount[]>([])
  const [editingUserId, setEditingUserId] = useState<string | null>(null)
  const [tempSelectedAccounts, setTempSelectedAccounts] = useState<Set<string>>(new Set())
  const [isSyncing, setIsSyncing] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'success' | 'error'>('success')

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    } else if (status === 'authenticated') {
      loadUsers()
      loadSocialAccounts()
    }
  }, [status, router])

  const loadUsers = async () => {
    try {
      const res = await fetch('/api/admin/users')
      if (res.ok) {
        const data = await res.json()
        setUsers(data.users || [])
      } else {
        console.error('Errore caricamento utenti:', await res.text())
      }
    } catch (error) {
      console.error('Errore caricamento utenti:', error)
      setMessage('❌ Errore nel caricamento degli utenti')
      setMessageType('error')
    }
  }

  const loadSocialAccounts = async () => {
    try {
      const res = await fetch('/api/admin/social-accounts')
      if (res.ok) {
        const data = await res.json()
        setSocialAccounts(data.accounts || [])
      } else {
        console.error('Errore caricamento account:', await res.text())
      }
    } catch (error) {
      console.error('Errore caricamento account:', error)
      setMessage('❌ Errore nel caricamento degli account')
      setMessageType('error')
    }
  }

  const syncOnlySocialAccounts = async () => {
    setIsSyncing(true)
    setMessage('')

    try {
      const res = await fetch('/api/admin/sync-accounts', {
        method: 'POST',
      })

      const data = await res.json()

      if (res.ok) {
        setMessage(`✅ ${data.message}`)
        setMessageType('success')
        await loadSocialAccounts()
      } else {
        setMessage(`❌ ${data.error}`)
        setMessageType('error')
      }
    } catch (error) {
      console.error('Errore sincronizzazione:', error)
      setMessage('❌ Errore nella sincronizzazione')
      setMessageType('error')
    } finally {
      setIsSyncing(false)
    }
  }

  const startEditing = (user: User) => {
    setEditingUserId(user.id)
    const currentAccountIds = new Set(
      user.adminAssociations.map(a => a.socialAccount.id)
    )
    setTempSelectedAccounts(currentAccountIds)
  }

  const toggleAccountSelection = (accountId: string) => {
    const newSelection = new Set(tempSelectedAccounts)
    if (newSelection.has(accountId)) {
      newSelection.delete(accountId)
    } else {
      newSelection.add(accountId)
    }
    setTempSelectedAccounts(newSelection)
  }

  const saveAssociations = async (userId: string) => {
    try {
      // Ottieni le associazioni correnti
      const user = users.find(u => u.id === userId)
      if (!user) return

      const currentAccountIds = new Set(
        user.adminAssociations.map(a => a.socialAccount.id)
      )

      // Trova gli account da aggiungere
      const toAdd = Array.from(tempSelectedAccounts).filter(
        id => !currentAccountIds.has(id)
      )

      // Trova gli account da rimuovere
      const toRemove = Array.from(currentAccountIds).filter(
        id => !tempSelectedAccounts.has(id)
      )

      // Aggiungi nuove associazioni
      for (const accountId of toAdd) {
        await fetch('/api/admin/associations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, socialAccountId: accountId }),
        })
      }

      // Rimuovi associazioni
      for (const accountId of toRemove) {
        await fetch('/api/admin/associations', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, socialAccountId: accountId }),
        })
      }

      setMessage('✅ Associazioni aggiornate con successo')
      setMessageType('success')
      setEditingUserId(null)
      await loadUsers()
    } catch (error) {
      console.error('Errore salvataggio:', error)
      setMessage('❌ Errore nel salvataggio')
      setMessageType('error')
    }
  }

  const cancelEditing = () => {
    setEditingUserId(null)
    setTempSelectedAccounts(new Set())
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Caricamento...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Pannello Amministratore
          </h1>
          <p className="mt-2 text-gray-600">
            Gestisci gli utenti e assegna gli account social OnlySocial
          </p>
        </div>

        {/* Sync Button */}
        <div className="mb-6 flex gap-4">
          <button
            onClick={syncOnlySocialAccounts}
            disabled={isSyncing}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            <span>{isSyncing ? '⏳' : '🔄'}</span>
            {isSyncing ? 'Sincronizzazione in corso...' : 'Sincronizza Account OnlySocial'}
          </button>
          
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span className="px-3 py-1 bg-white rounded-lg border border-gray-200">
              {users.length} Utenti
            </span>
            <span className="px-3 py-1 bg-white rounded-lg border border-gray-200">
              {socialAccounts.length} Account Social
            </span>
          </div>
        </div>

        {/* Message */}
        {message && (
          <div
            className={`mb-6 p-4 rounded-lg ${
              messageType === 'success'
                ? 'bg-green-50 text-green-800 border border-green-200'
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}
          >
            {message}
          </div>
        )}

        {/* Users Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold">Utenti Registrati</h2>
          </div>

          {users.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              Nessun utente registrato
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Utente
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Data Registrazione
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Account Social Associati
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Stato
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Azioni
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-medium text-gray-900">{user.name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-600">{user.email}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-600">
                          {new Date(user.createdAt).toLocaleDateString('it-IT')}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {editingUserId === user.id ? (
                          <div className="space-y-2 max-w-md">
                            <div className="text-xs font-medium text-gray-700 mb-2">
                              Seleziona account social:
                            </div>
                            <div className="max-h-48 overflow-y-auto space-y-1 border border-gray-200 rounded p-2">
                              {socialAccounts.length === 0 ? (
                                <div className="text-xs text-gray-500 text-center py-2">
                                  Nessun account disponibile. Sincronizza prima.
                                </div>
                              ) : (
                                socialAccounts.map((account) => (
                                  <label
                                    key={account.id}
                                    className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={tempSelectedAccounts.has(account.id)}
                                      onChange={() => toggleAccountSelection(account.id)}
                                      className="w-4 h-4 text-blue-600 rounded"
                                    />
                                    <div className="text-sm">
                                      <div className="font-medium text-gray-900">
                                        {account.accountName}
                                      </div>
                                      <div className="text-xs text-gray-500">
                                        {account.platform}
                                      </div>
                                    </div>
                                  </label>
                                ))
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {user.adminAssociations.length === 0 ? (
                              <span className="text-sm text-gray-400 italic">
                                Nessun account associato
                              </span>
                            ) : (
                              user.adminAssociations.map((assoc) => (
                                <span
                                  key={assoc.id}
                                  className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-700"
                                >
                                  {assoc.socialAccount.platform} • {assoc.socialAccount.accountName}
                                </span>
                              ))
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            user.isActive
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {user.isActive ? 'Attivo' : 'Inattivo'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        {editingUserId === user.id ? (
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => saveAssociations(user.id)}
                              className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                            >
                              ✓ Salva
                            </button>
                            <button
                              onClick={cancelEditing}
                              className="px-3 py-1 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 transition-colors"
                            >
                              ✕ Annulla
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => startEditing(user)}
                            className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                          >
                            ✎ Modifica
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Available Social Accounts */}
        <div className="mt-8 bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold">Account Social Disponibili</h2>
            <p className="text-sm text-gray-600 mt-1">
              Account sincronizzati da OnlySocial
            </p>
          </div>
          <div className="p-6">
            {socialAccounts.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500 mb-4">
                  Nessun account sincronizzato. Clicca su &quot;Sincronizza Account OnlySocial&quot; per importare gli account.
                </p>
                <button
                  onClick={syncOnlySocialAccounts}
                  disabled={isSyncing}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
                >
                  {isSyncing ? 'Sincronizzazione...' : '🔄 Sincronizza Ora'}
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {socialAccounts.map((account) => (
                  <div
                    key={account.id}
                    className="border border-gray-200 rounded-lg p-4"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900">
                          {account.accountName}
                        </h3>
                        <p className="text-sm text-gray-600 mt-1">
                          {account.platform}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          ID: {account.accountId}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
