'use client'

import { useState, useEffect } from 'react'

interface User {
  id: string
  name: string
  email: string
  isActive: boolean
  createdAt: string
}

interface SocialAccount {
  id: string
  platform: string
  accountName: string
  accountId: string
  isActive: boolean
}

export default function AdminPage() {
  const [users, setUsers] = useState<User[]>([])
  const [socialAccounts, setSocialAccounts] = useState<SocialAccount[]>([])
  const [selectedUser, setSelectedUser] = useState<string>('')
  const [selectedAccount, setSelectedAccount] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState('')

  // Mock data for demonstration
  useEffect(() => {
    // Simulate loading users
    setUsers([
      {
        id: '1',
        name: 'Mario Rossi',
        email: 'mario@example.com',
        isActive: false,
        createdAt: '2024-01-15'
      },
      {
        id: '2',
        name: 'Giulia Bianchi',
        email: 'giulia@example.com',
        isActive: true,
        createdAt: '2024-01-10'
      }
    ])

    // Simulate loading social accounts
    setSocialAccounts([
      {
        id: '1',
        platform: 'Instagram',
        accountName: '@fashion_brand_official',
        accountId: 'ig_12345',
        isActive: true
      },
      {
        id: '2',
        platform: 'Facebook',
        accountName: 'Fashion Brand Page',
        accountId: 'fb_67890',
        isActive: true
      },
      {
        id: '3',
        platform: 'TikTok',
        accountName: '@fashionbrand',
        accountId: 'tt_54321',
        isActive: true
      }
    ])
  }, [])

  const handleAssignAccount = async () => {
    if (!selectedUser || !selectedAccount) {
      setMessage('Seleziona un utente e un account social')
      return
    }

    setIsLoading(true)
    setMessage('')

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // Update user status to active
      setUsers(prev => prev.map(user => 
        user.id === selectedUser 
          ? { ...user, isActive: true }
          : user
      ))

      setMessage('Account social assegnato con successo!')
      setSelectedUser('')
      setSelectedAccount('')
    } catch {
      setMessage('Errore nell\'assegnazione dell\'account')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-gray-900">
                Pannello Amministratore
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-500">Admin Panel</span>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Users Management */}
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <h2 className="text-lg font-medium text-gray-900 mb-4">
                  Gestione Utenti
                </h2>
                <div className="space-y-3">
                  {users.map((user) => (
                    <div key={user.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">{user.name}</p>
                        <p className="text-sm text-gray-500">{user.email}</p>
                        <p className="text-xs text-gray-400">Registrato: {user.createdAt}</p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          user.isActive 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {user.isActive ? 'Attivo' : 'In attesa'}
                        </span>
                        <button
                          onClick={() => setSelectedUser(user.id)}
                          className={`text-sm px-3 py-1 rounded ${
                            selectedUser === user.id
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                          }`}
                        >
                          {selectedUser === user.id ? 'Selezionato' : 'Seleziona'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Social Accounts */}
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <h2 className="text-lg font-medium text-gray-900 mb-4">
                  Account Social Disponibili
                </h2>
                <div className="space-y-3">
                  {socialAccounts.map((account) => (
                    <div key={account.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-medium text-gray-900">{account.platform}</span>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            account.platform === 'Instagram' ? 'bg-pink-100 text-pink-800' :
                            account.platform === 'Facebook' ? 'bg-blue-100 text-blue-800' :
                            account.platform === 'TikTok' ? 'bg-gray-100 text-gray-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {account.platform}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600">{account.accountName}</p>
                        <p className="text-xs text-gray-400">ID: {account.accountId}</p>
                      </div>
                      <button
                        onClick={() => setSelectedAccount(account.id)}
                        className={`text-sm px-3 py-1 rounded ${
                          selectedAccount === account.id
                            ? 'bg-green-600 text-white'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                      >
                        {selectedAccount === account.id ? 'Selezionato' : 'Seleziona'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Assignment Section */}
          <div className="mt-6 bg-white overflow-hidden shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">
                Assegna Account Social
              </h2>
              
              <div className="bg-gray-50 p-4 rounded-lg mb-4">
                <p className="text-sm text-gray-700 mb-2">
                  <strong>Utente selezionato:</strong> {
                    selectedUser 
                      ? users.find(u => u.id === selectedUser)?.name || 'Nessuno'
                      : 'Nessuno'
                  }
                </p>
                <p className="text-sm text-gray-700">
                  <strong>Account social selezionato:</strong> {
                    selectedAccount 
                      ? socialAccounts.find(a => a.id === selectedAccount)?.accountName || 'Nessuno'
                      : 'Nessuno'
                  }
                </p>
              </div>

              {message && (
                <div className={`mb-4 p-3 rounded-lg ${
                  message.includes('successo') 
                    ? 'bg-green-50 border border-green-200 text-green-700'
                    : 'bg-red-50 border border-red-200 text-red-700'
                }`}>
                  {message}
                </div>
              )}

              <button
                onClick={handleAssignAccount}
                disabled={!selectedUser || !selectedAccount || isLoading}
                className="w-full sm:w-auto px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Assegnazione in corso...' : 'Assegna Account'}
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
