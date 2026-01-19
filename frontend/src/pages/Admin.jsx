import { useState } from 'react'
import { createUser } from '../services/api'

const initialForm = {
  name: '',
  email: '',
  password: '',
  bank_id: '',
  role_id: '',
}

export default function Admin() {
  const [form, setForm] = useState(initialForm)
  const [status, setStatus] = useState({ type: '', message: '' })
  const [submitting, setSubmitting] = useState(false)

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setStatus({ type: '', message: '' })
    setSubmitting(true)

    try {
      const payload = {
        name: form.name,
        email: form.email,
        password: form.password,
        bank_id: Number(form.bank_id),
        role_id: form.role_id ? Number(form.role_id) : null,
      }
      await createUser(payload)
      setStatus({ type: 'success', message: 'User created successfully.' })
      setForm(initialForm)
    } catch (err) {
      setStatus({ type: 'error', message: err?.response?.data?.detail || 'Unable to create user.' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-8">
          <h1 className="text-2xl font-bold text-slate-900">Admin: Create User</h1>
          <p className="text-sm text-slate-600 mt-1">Add new accounts for your organization.</p>

          <form onSubmit={handleSubmit} className="mt-6 grid grid-cols-1 gap-4">
            <div>
              <label className="text-sm font-medium text-slate-700">Full name</label>
              <input
                type="text"
                name="name"
                value={form.name}
                onChange={handleChange}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-700"
                required
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">Email address</label>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-700"
                required
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">Temporary password</label>
              <input
                type="password"
                name="password"
                value={form.password}
                onChange={handleChange}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-700"
                required
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="text-sm font-medium text-slate-700">Bank ID</label>
                <input
                  type="number"
                  name="bank_id"
                  value={form.bank_id}
                  onChange={handleChange}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-700"
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Role ID (optional)</label>
                <input
                  type="number"
                  name="role_id"
                  value={form.role_id}
                  onChange={handleChange}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-700"
                />
              </div>
            </div>

            {status.message && (
              <div
                className={`rounded-lg border px-3 py-2 text-sm ${
                  status.type === 'success'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    : 'border-red-200 bg-red-50 text-red-700'
                }`}
              >
                {status.message}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-slate-900 text-white py-2 text-sm font-semibold hover:bg-slate-800 transition disabled:opacity-60"
            >
              {submitting ? 'Creating...' : 'Create user'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
