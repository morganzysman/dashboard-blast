<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">{{ $t('companies.title') }}</h1>
        <p class="text-sm text-gray-600 mt-1">{{ $t('companies.subtitle') }}</p>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-5 gap-2 items-end">
        <div>
          <label class="form-label">{{ $t('companies.companyName') }}</label>
          <input v-model.trim="newCompanyName" class="form-input" :placeholder="$t('companies.newCompanyName')" />
        </div>
        <div>
          <label class="form-label">{{ $t('companies.timezone') }}</label>
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
          <label class="form-label">{{ $t('companies.currency') }}</label>
          <select v-model="newCompanyCurrency" class="form-input">
            <option value="PEN">🇵🇪 PEN</option>
            <option value="MXN">🇲🇽 MXN</option>
            <option value="USD">🇺🇸 USD</option>
            <option value="EUR">🇪🇺 EUR</option>
            <option value="GBP">🇬🇧 GBP</option>
          </select>
        </div>
        <div>
          <label class="form-label">{{ $t('companies.language') }}</label>
          <select v-model="newCompanyLanguage" class="form-input">
            <option value="pt">🇧🇷 Português</option>
            <option value="es">🇪🇸 Español</option>
            <option value="en">🇺🇸 English</option>
            <option value="fr">🇫🇷 Français</option>
          </select>
        </div>
        <div>
          <button class="btn-primary w-full" :disabled="!canCreate" @click="createNewCompany">{{ $t('common.create') }}</button>
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
              <div class="text-xs text-gray-500 mt-1">{{ $t('companies.timezone') }}: {{ c.timezone || 'America/Lima' }} • {{ $t('companies.currency') }}: {{ c.currency || 'PEN' }} • {{ $t('companies.language') }}: {{ getLanguageName(c.language) }}</div>
            </div>
            <div class="flex items-center space-x-2">
              <button class="btn-danger" @click="deleteCompany(c.id)" :title="$t('common.delete')">{{ $t('common.delete') }}</button>
              <input v-model="accountForm[c.id].company_token" class="form-input" :placeholder="$t('companies.companyToken')" />
              <input v-model="accountForm[c.id].account_name" class="form-input" :placeholder="$t('companies.accountName')" />
              <input v-model="accountForm[c.id].api_token" class="form-input" :placeholder="$t('companies.apiToken')" />
              <button class="btn-secondary" @click="saveAccount(c.id)">{{ $t('companies.addUpdateAccount') }}</button>
            </div>
          </div>
          <div class="mt-4">
            <Table :stickyHeader="true">
              <template #head>
                <th class="py-2">{{ $t('companies.accountName') }}</th>
                <th class="py-2">{{ $t('companies.companyToken') }}</th>
                <th class="py-2">{{ $t('companies.apiToken') }}</th>
                <th class="py-2 text-right">{{ $t('companies.actions') }}</th>
              </template>
              <tr v-for="a in accounts[c.id] || []" :key="a.company_token" class="border-t transition-colors duration-150" style="border-color: rgba(229,231,235,0.3);" onmouseover="this.style.background='rgba(255,255,255,0.6)'" onmouseout="this.style.background='transparent'">
                  <td>
                    <div v-if="isEditing(c.id, a.company_token)">
                      <input v-model.trim="editForm[c.id][a.company_token].account_name" class="form-input w-full" :placeholder="$t('companies.accountName')" />
                    </div>
                    <div v-else>
                      {{ a.account_name || a.company_token }}
                    </div>
                  </td>
                  <td class="font-mono text-xs">{{ a.company_token }}</td>
                  <td>
                    <div v-if="isEditing(c.id, a.company_token)" class="flex items-center gap-2">
                      <input :type="showToken[c.id]?.[a.company_token] ? 'text' : 'password'" v-model.trim="editForm[c.id][a.company_token].api_token" class="form-input w-full" :placeholder="$t('companies.apiToken')" />
                      <button class="btn-secondary btn-xs" @click="toggleShowToken(c.id, a.company_token)">{{ showToken[c.id]?.[a.company_token] ? $t('common.hide') : $t('common.show') }}</button>
                    </div>
                    <div v-else>
                      <span v-if="a.api_token" class="text-gray-500">{{ a.api_token.substring(0,8) }}…</span>
                      <span v-else class="text-gray-400">—</span>
                    </div>
                  </td>
                  <td class="text-right">
                    <div v-if="isEditing(c.id, a.company_token)" class="flex justify-end gap-2">
                      <button class="btn-secondary btn-xs" @click="cancelEdit(c.id)">{{ $t('common.cancel') }}</button>
                      <button class="btn-primary btn-xs" @click="saveEdit(c.id, a.company_token)">{{ $t('common.save') }}</button>
                    </div>
                    <div v-else class="flex justify-end gap-2">
                      <button class="btn-secondary btn-xs" @click="startEdit(c.id, a)">{{ $t('common.edit') }}</button>
                      <button class="btn-danger btn-xs" @click="removeAccount(c.id, a.company_token)">{{ $t('common.delete') }}</button>
                    </div>
                  </td>
                </tr>
            </Table>
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
import { useI18n } from 'vue-i18n'
import Table from '../components/ui/Table.vue'

const { t } = useI18n()

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
const newCompanyLanguage = ref('pt')

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
  const res = await api.createCompany(newCompanyName.value, newCompanyTimezone.value, newCompanyCurrency.value, newCompanyLanguage.value)
  if (res.success) {
    newCompanyName.value = ''
    newCompanyTimezone.value = 'America/Lima'
    newCompanyCurrency.value = 'PEN'
    newCompanyLanguage.value = 'pt'
    await load()
  }
}

const getLanguageName = (languageCode) => {
  const languages = {
    'pt': 'Português',
    'es': 'Español',
    'en': 'English',
    'fr': 'Français'
  }
  return languages[languageCode] || 'Português'
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
  if (!confirm(t('companies.deleteConfirm'))) return
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


