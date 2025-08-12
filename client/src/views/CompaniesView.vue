<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">Companies</h1>
        <p class="text-sm text-gray-600 mt-1">Manage companies and their OlaClick accounts</p>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-4 gap-2 items-end">
        <div>
          <label class="form-label">Company Name</label>
          <input v-model.trim="newCompanyName" class="form-input" placeholder="New company name" />
        </div>
        <div>
          <label class="form-label">Timezone</label>
          <select v-model="newCompanyTimezone" class="form-input">
            <option value="America/Lima">🇵🇪 Lima (UTC-5)</option>
            <option value="America/Mexico_City">🇲🇽 Mexico City (UTC-6)</option>
            <option value="America/New_York">🇺🇸 New York (UTC-5)</option>
            <option value="America/Los_Angeles">🇺🇸 Los Angeles (UTC-8)</option>
            <option value="Europe/London">🇬🇧 London (UTC+0)</option>
            <option value="Europe/Madrid">🇪🇸 Madrid (UTC+1)</option>
          </select>
        </div>
        <div>
          <label class="form-label">Currency</label>
          <select v-model="newCompanyCurrency" class="form-input">
            <option value="PEN">🇵🇪 PEN</option>
            <option value="MXN">🇲🇽 MXN</option>
            <option value="USD">🇺🇸 USD</option>
            <option value="EUR">🇪🇺 EUR</option>
            <option value="GBP">🇬🇧 GBP</option>
          </select>
        </div>
        <div>
          <button class="btn-primary w-full" :disabled="!canCreate" @click="createNewCompany">Create</button>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 gap-4">
      <div v-for="c in companies" :key="c.id" class="card">
        <div class="card-body">
          <div class="flex items-start justify-between">
            <div>
              <div class="text-lg font-semibold">{{ c.name }}</div>
              <div class="text-xs text-gray-500">{{ c.id }}</div>
              <div class="text-xs text-gray-500 mt-1">Timezone: {{ c.timezone || 'America/Lima' }} • Currency: {{ c.currency || 'PEN' }}</div>
            </div>
            <div class="flex items-center space-x-2">
              <button class="btn-danger" @click="deleteCompany(c.id)" title="Delete Company">Delete</button>
              <input v-model="accountForm[c.id].company_token" class="form-input" placeholder="Company token" />
              <input v-model="accountForm[c.id].account_name" class="form-input" placeholder="Account name" />
              <input v-model="accountForm[c.id].api_token" class="form-input" placeholder="API token" />
              <button class="btn-secondary" @click="saveAccount(c.id)">Add/Update Account</button>
            </div>
          </div>
          <div class="mt-4">
            <table class="table">
              <thead class="table-header">
                <tr>
                  <th>Account Name</th>
                  <th>Company Token</th>
                  <th>API Token</th>
                  <th class="text-right">Actions</th>
                </tr>
              </thead>
              <tbody class="table-body">
                <tr v-for="a in accounts[c.id] || []" :key="a.company_token">
                  <td>
                    <div v-if="isEditing(c.id, a.company_token)">
                      <input v-model.trim="editForm[c.id][a.company_token].account_name" class="form-input w-full" placeholder="Account name" />
                    </div>
                    <div v-else>
                      {{ a.account_name || a.company_token }}
                    </div>
                  </td>
                  <td class="font-mono text-xs">{{ a.company_token }}</td>
                  <td>
                    <div v-if="isEditing(c.id, a.company_token)" class="flex items-center gap-2">
                      <input :type="showToken[c.id]?.[a.company_token] ? 'text' : 'password'" v-model.trim="editForm[c.id][a.company_token].api_token" class="form-input w-full" placeholder="API token" />
                      <button class="btn-secondary btn-xs" @click="toggleShowToken(c.id, a.company_token)">{{ showToken[c.id]?.[a.company_token] ? 'Hide' : 'Show' }}</button>
                    </div>
                    <div v-else>
                      <span v-if="a.api_token" class="text-gray-500">{{ a.api_token.substring(0,8) }}…</span>
                      <span v-else class="text-gray-400">—</span>
                    </div>
                  </td>
                  <td class="text-right">
                    <div v-if="isEditing(c.id, a.company_token)" class="flex justify-end gap-2">
                      <button class="btn-secondary btn-xs" @click="cancelEdit(c.id)">Cancel</button>
                      <button class="btn-primary btn-xs" @click="saveEdit(c.id, a.company_token)">Save</button>
                    </div>
                    <div v-else class="flex justify-end gap-2">
                      <button class="btn-secondary btn-xs" @click="startEdit(c.id, a)">Edit</button>
                      <button class="btn-danger btn-xs" @click="removeAccount(c.id, a.company_token)">Delete</button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue'
import api from '../utils/api'
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()
const companies = ref([])
const accounts = reactive({})
const accountForm = reactive({})
const editForm = reactive({}) // { [companyId]: { [company_token]: { account_name, api_token } } }
const editing = reactive({}) // { [companyId]: company_token | null }
const showToken = reactive({}) // { [companyId]: { [company_token]: boolean } }
const newCompanyName = ref('')
const canCreate = computed(() => newCompanyName.value && newCompanyName.value.length >= 3)
const newCompanyTimezone = ref('America/Lima')
const newCompanyCurrency = ref('PEN')

const load = async () => {
  const res = await api.listCompanies()
  if (res.success) {
    companies.value = res.data
    for (const c of companies.value) {
      const a = await api.listCompanyAccounts(c.id)
      accounts[c.id] = a.success ? a.data : []
      accountForm[c.id] = { company_token: '', account_name: '', api_token: '' }
      editForm[c.id] = editForm[c.id] || {}
      editing[c.id] = null
      showToken[c.id] = showToken[c.id] || {}
    }
  }
}

const createNewCompany = async () => {
  if (!canCreate.value) return
  const res = await api.createCompany(newCompanyName.value, newCompanyTimezone.value, newCompanyCurrency.value)
  if (res.success) {
    newCompanyName.value = ''
    newCompanyTimezone.value = 'America/Lima'
    newCompanyCurrency.value = 'PEN'
    await load()
  }
}

const saveAccount = async (companyId) => {
  const payload = accountForm[companyId]
  if (!payload.company_token) return
  const res = await api.upsertCompanyAccount(companyId, payload)
  if (res.success) {
    accountForm[companyId] = { company_token: '', account_name: '', api_token: '' }
    const a = await api.listCompanyAccounts(companyId)
    accounts[companyId] = a.success ? a.data : []
  }
}

const removeAccount = async (companyId, token) => {
  const res = await api.deleteCompanyAccount(companyId, token)
  if (res.success) {
    accounts[companyId] = (accounts[companyId] || []).filter(x => x.company_token !== token)
  }
}

// Inline editing helpers
const isEditing = (companyId, token) => editing[companyId] === token
const startEdit = (companyId, account) => {
  editing[companyId] = account.company_token
  editForm[companyId][account.company_token] = {
    account_name: account.account_name || '',
    api_token: account.api_token || ''
  }
}
const cancelEdit = (companyId) => { editing[companyId] = null }
const toggleShowToken = (companyId, token) => {
  showToken[companyId][token] = !showToken[companyId][token]
}
const saveEdit = async (companyId, token) => {
  const payload = {
    company_token: token,
    account_name: editForm[companyId][token]?.account_name || '',
    api_token: editForm[companyId][token]?.api_token || ''
  }
  const res = await api.upsertCompanyAccount(companyId, payload)
  if (res.success) {
    const a = await api.listCompanyAccounts(companyId)
    accounts[companyId] = a.success ? a.data : []
    editing[companyId] = null
  }
}

const deleteCompany = async (companyId) => {
  if (!confirm('Delete this company? This action cannot be undone.')) return
  const res = await api.delete(`/api/admin/companies/${companyId}`)
  if (res.success) {
    companies.value = companies.value.filter(c => c.id !== companyId)
    delete accounts[companyId]
    delete accountForm[companyId]
  }
}

onMounted(load)
</script>

<style scoped>
</style>


