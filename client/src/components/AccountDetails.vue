<template>
  <div class="space-y-4">
    <h3 class="text-base sm:text-lg font-medium text-gray-900">🏪 {{ $t('dashboard.accountDetails') }}</h3>

    <!-- Loading skeletons -->
    <div v-if="loading" class="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
      <div v-for="n in 4" :key="`skeleton-${n}`" class="card">
        <div class="card-body">
          <div class="flex items-center gap-2 mb-4 animate-pulse">
            <div class="h-5 w-14 bg-gray-200 rounded-full"></div>
            <div class="h-4 w-40 bg-gray-200 rounded"></div>
          </div>
          <div class="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4 animate-pulse">
            <div class="bg-gray-50 rounded-lg p-3 text-center">
              <div class="h-5 bg-gray-200 rounded mb-1"></div>
              <div class="h-3 bg-gray-200 rounded"></div>
            </div>
            <div class="bg-gray-50 rounded-lg p-3 text-center">
              <div class="h-5 bg-gray-200 rounded mb-1"></div>
              <div class="h-3 bg-gray-200 rounded"></div>
            </div>
            <div class="bg-gray-50 rounded-lg p-3 text-center">
              <div class="h-5 bg-gray-200 rounded mb-1"></div>
              <div class="h-3 bg-gray-200 rounded"></div>
            </div>
            <div class="bg-gray-50 rounded-lg p-3 text-center">
              <div class="h-5 bg-gray-200 rounded mb-1"></div>
              <div class="h-3 bg-gray-200 rounded"></div>
            </div>
            <div class="bg-gray-50 rounded-lg p-3 text-center">
              <div class="h-5 bg-gray-200 rounded mb-1"></div>
              <div class="h-3 bg-gray-200 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Accounts content -->
    <div v-else-if="analyticsData && analyticsData.accounts.length > 0" class="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
      <div v-for="account in analyticsData.accounts" :key="`${account.accountKey}-${forceRecompute}`" class="card">
        <div class="card-body">
          <!-- Account Header -->
          <div class="flex items-center gap-2 mb-4">
            <span class="badge" :class="account.success ? 'badge-success' : 'badge-danger'">
              {{ account.success ? $t('common.active') : $t('common.error') }}
            </span>
            <div class="relative group">
              <h4 class="font-medium text-gray-900 text-sm sm:text-base truncate cursor-pointer" :title="account.account">
                {{ account.account }}
              </h4>
              <!-- Custom tooltip -->
              <div class="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-1 bg-gray-900 text-white text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50 invisible group-hover:visible">
                {{ account.account }}
              </div>
            </div>
          </div>

          <!-- Account Indicators -->
          <div class="mb-4">
            <details :open="isDesktop" class="rounded-lg border border-gray-100 lg:border-0 lg:rounded-none">
              <summary
                class="lg:hidden flex items-center justify-between px-2 py-2 text-sm font-medium text-gray-800 cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden border-b border-gray-100 mb-2"
              >
                <span>{{ $t('account.accountKpiToggle') }}</span>
                <span class="text-gray-400 text-xs" aria-hidden="true">▼</span>
              </summary>
              <div class="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
              <div class="bg-indigo-50 rounded-lg p-3 text-center">
                <p class="text-sm sm:text-lg font-bold text-indigo-600 truncate">{{ formatCurrency(getAccountAvgTicket(account)) }}</p>
                <p class="text-xs text-indigo-500">{{ $t('dashboard.avgTicket') }}</p>
              </div>

              <div class="bg-amber-50 rounded-lg p-3 text-center">
                <p class="text-sm sm:text-lg font-bold text-amber-600 truncate">{{ formatCurrency(getAccountTotalTips(account)) }}</p>
                <p class="text-xs text-amber-500">{{ $t('dashboard.tips') }}</p>
              </div>

              <div class="bg-emerald-50 rounded-lg p-3 text-center">
                <p class="text-sm sm:text-lg font-bold text-emerald-600 truncate">{{ formatKitchenPerformance(getAccountKitchenPerformance(account)) }}</p>
                <p class="text-xs text-emerald-600">{{ $t('account.kitchenPerf') }}</p>
                <p class="text-[10px] leading-tight text-emerald-600/70 mt-0.5">{{ $t('account.kitchenPerfOverall') }}</p>
              </div>

              <div v-if="kitchenSlaScore(account) != null" class="bg-teal-50 rounded-lg p-3 text-center">
                <p class="text-sm sm:text-lg font-bold text-teal-700 truncate">{{ kitchenSlaScore(account) }}</p>
                <p class="text-xs text-teal-600">{{ $t('account.kitchenSlaScore') }}</p>
                <p class="text-[10px] leading-tight text-teal-600/70 mt-0.5">{{ kitchenOnTimePct(account) }}</p>
              </div>
              <div v-else class="bg-gray-50 rounded-lg p-3 text-center">
                <p class="text-sm sm:text-lg font-bold text-gray-400 truncate">—</p>
                <p class="text-xs text-gray-500">{{ $t('account.kitchenSlaScore') }}</p>
              </div>

              <!-- Daily Gain KPI -->
              <div class="bg-purple-50 rounded-lg p-3 text-center">
                <p class="text-sm sm:text-lg font-bold truncate" :class="getDailyGainClass(account)">
                  {{ formatCurrency(accountDailyGains.get(account.accountKey) || 0) }}
                </p>
                <p class="text-xs text-purple-500">{{ formatGainPeriodLabel() }} Gain</p>

                <!-- Popover for details -->
                <Popover class="mt-2 inline-block" :panel-class="'left-1/2 -translate-x-1/2 lg:left-auto lg:right-0 lg:translate-x-0'" :key="`breakdown-${account.accountKey}-${forceRecompute}`">
                  <template #button>
                    <span class="text-xs text-purple-600 hover:text-purple-800 underline">{{ $t('dashboard.viewBreakdown') }}</span>
                  </template>
                  <template #title>
                    <h4 class="font-bold text-purple-300 text-sm">💰 {{ $t('account.gainBreakdown') }} ({{ formatGainPeriodLabel() }})</h4>
                  </template>
                  <div v-if="account.success && account.data?.data" class="space-y-4">
                    <!-- Revenue by Payment Method -->
                    <div>
                      <h5 class="font-semibold text-blue-300 mb-3 text-sm">📊 {{ $t('account.revenueByMethod') }}:</h5>
                      <div v-for="method in accountBreakdowns.get(account.accountKey)?.paymentMethodBreakdown || []" :key="method.method" class="mb-2">
                        <div class="flex justify-between items-center mb-1">
                          <span class="capitalize text-sm font-medium">{{ method.method }}:</span>
                          <span class="text-green-300 font-bold">{{ formatCurrency(method.netRevenue) }}</span>
                        </div>
                        <div class="text-xs text-gray-400 text-right">
                          {{ formatCurrency(method.revenue) }} 
                          <span v-if="method.fees > 0">- {{ formatCurrency(method.fees) }} fees</span>
                        </div>
                      </div>
                      <!-- Total Revenue -->
                      <div class="border-t border-blue-700 pt-2 mt-3">
                        <div class="flex justify-between items-center">
                          <span class="text-sm font-bold text-blue-300">{{ $t('account.totalRevenue') }}:</span>
                          <span class="text-blue-300 font-bold">{{ formatCurrency(accountBreakdowns.get(account.accountKey)?.totalRevenue || 0) }}</span>
                        </div>
                      </div>
                    </div>
                    
                    <!-- Cost Breakdown -->
                    <div class="border-t border-gray-700 pt-3">
                      <h5 class="font-semibold text-red-300 mb-3 text-sm">📉 {{ $t('account.costs') }}:</h5>
                      <div class="space-y-2">
                        <div class="flex justify-between items-center">
                          <span class="text-sm">{{ $t('account.paymentFees') }}:</span>
                          <span class="text-red-300 font-bold">-{{ formatCurrency(accountBreakdowns.get(account.accountKey)?.paymentFees || 0) }}</span>
                        </div>
                        <div class="flex justify-between items-center">
                          <span class="text-sm">{{ $t('account.foodCosts') }}:</span>
                          <span class="text-red-300 font-bold">-{{ formatCurrency(accountBreakdowns.get(account.accountKey)?.foodCosts || 0) }}</span>
                        </div>
                        <div class="flex justify-between items-center">
                          <span class="text-sm">{{ $t('account.utilityCosts', { days: accountBreakdowns.get(account.accountKey)?.daysInPeriod || 1 }) }}:</span>
                          <span class="text-red-300 font-bold">-{{ formatCurrency(accountBreakdowns.get(account.accountKey)?.utilityCosts || 0) }}</span>
                        </div>
                        <div class="flex justify-between items-center">
                          <span class="text-sm">{{ $t('account.payroll', { entries: accountBreakdowns.get(account.accountKey)?.payrollEntries || 0 }) }}:</span>
                          <span class="text-red-300 font-bold">-{{ formatCurrency(accountBreakdowns.get(account.accountKey)?.payrollCosts || 0) }}</span>
                        </div>
                      </div>
                      <!-- Total Costs -->
                      <div class="border-t border-red-700 pt-2 mt-3">
                        <div class="flex justify-between items-center">
                          <span class="text-sm font-bold text-red-300">{{ $t('account.totalCosts') }}:</span>
                          <span class="text-red-300 font-bold">-{{ formatCurrency(accountBreakdowns.get(account.accountKey)?.totalCosts || 0) }}</span>
                        </div>
                      </div>
                    </div>
                    
                    <!-- Final Result -->
                    <div class="border-t-2 border-gray-600 pt-3 mt-3">
                      <div class="flex justify-between items-center">
                        <span class="text-lg font-bold">{{ $t('account.finalGain') }}:</span>
                        <span class="text-lg font-bold" :class="(accountDailyGains.get(account.accountKey) || 0) > 0 ? 'text-green-300' : 'text-red-300'">
                          {{ formatCurrency(accountBreakdowns.get(account.accountKey)?.finalGain || 0) }}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div v-else class="text-gray-400 text-center">
                    {{ $t('account.noPaymentData') }}
                  </div>
                </Popover>
              </div>
            </div>
          </details>
          </div>

          <!-- Additional Profitability Chips (none currently) -->
          <div v-if="account.success && account.data" class="space-y-3">
          
            <!-- Account Payment Methods -->
            <div v-if="account.data.data && account.data.data.length > 0" class="bg-white border border-gray-100 rounded-lg p-3">
              <h5 class="text-xs font-medium text-gray-700 mb-2 flex items-center">
                <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"></path>
                </svg>
                {{ $t('account.paymentMethods') }}
              </h5>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div v-for="method in getAccountPaymentMethods(account)" :key="method.name" 
                     class="bg-gray-50 rounded p-2">
                  <div class="flex items-center space-x-2 mb-1">
                    <div class="w-2 h-2 rounded-full flex-shrink-0" :style="{ backgroundColor: getPaymentMethodColor(method.name) }"></div>
                    <p class="font-medium text-gray-900 capitalize text-xs truncate">{{ method.name }}</p>
                  </div>
                  <div class="space-y-0.5">
                    <p class="font-bold text-gray-900 text-xs">{{ formatCurrency(method.sum) }}</p>
                    <div class="flex items-center justify-between text-xs text-gray-500">
                      <span>{{ method.count }} {{ $t('account.transactions') }}</span>
                      <span>{{ method.percent.toFixed(1) }}%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Kitchen prep & SLA -->
            <div
              v-if="account.success && hasKitchenBreakdown(account)"
              class="bg-white border border-gray-100 rounded-lg mt-3 overflow-hidden"
            >
              <details :open="isDesktop" class="group">
                <summary
                  class="flex items-center justify-between cursor-pointer list-none px-3 py-2.5 text-xs font-medium text-gray-800 select-none [&::-webkit-details-marker]:hidden lg:cursor-default border-b border-gray-100 bg-gray-50/80"
                >
                  <span class="flex items-center gap-1.5 min-w-0">
                    <svg class="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span class="truncate">{{ $t('account.kitchenSectionToggle') }}</span>
                  </span>
                  <span class="lg:hidden text-[10px] text-gray-500 shrink-0" aria-hidden="true">▼</span>
                </summary>
                <div class="p-3 space-y-3">
                  <p class="text-[11px] text-gray-500">{{ $t('account.kitchenPrepSubtitle') }}</p>

                  <details class="rounded border border-gray-100">
                    <summary class="cursor-pointer list-none px-2 py-2 [&::-webkit-details-marker]:hidden">
                      <p class="text-[11px] font-semibold text-gray-800">
                        {{ $t('account.kitchenOutOfSla') }}
                        <span class="font-normal text-gray-500">({{ slaBreachesForAccount(account).length }})</span>
                      </p>
                    </summary>
                    <div class="p-2 pt-0">
                      <p v-if="slaBreachTruncNote(account)" class="text-[10px] text-amber-800 mb-1">{{ $t('companyKitchen.breachTruncated') }}</p>
                      <div v-if="slaBreachesForAccount(account).length" class="max-h-52 overflow-auto rounded border border-gray-100">
                        <table class="w-full text-[11px]">
                          <thead class="bg-gray-50 text-gray-600 sticky top-0">
                            <tr>
                              <th class="text-left font-medium px-2 py-1.5">{{ $t('account.kitchenTableOrderId') }}</th>
                              <th class="text-left font-medium px-2 py-1.5">{{ $t('account.kitchenTableChannel') }}</th>
                              <th class="text-right font-medium px-2 py-1.5">{{ $t('account.kitchenTableGoal') }}</th>
                              <th class="text-right font-medium px-2 py-1.5">{{ $t('account.kitchenTableAvg') }}</th>
                              <th class="text-right font-medium px-2 py-1.5">{{ $t('account.kitchenTableExtra') }}</th>
                              <th class="w-6 px-1 py-1.5" aria-hidden="true"></th>
                            </tr>
                          </thead>
                          <tbody>
                            <template v-for="(b, i) in slaBreachesForAccount(account)" :key="`${b.orderId}-${i}`">
                              <tr
                                class="border-t border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors focus:outline-none focus:bg-gray-50"
                                :class="{ 'bg-gray-50/80': isProductsOpen(b.orderId) }"
                                role="button"
                                tabindex="0"
                                :aria-expanded="isProductsOpen(b.orderId) ? 'true' : 'false'"
                                :aria-label="$t('account.kitchenShowProducts')"
                                @click="toggleProducts(account, b)"
                                @keydown.enter.prevent="toggleProducts(account, b)"
                                @keydown.space.prevent="toggleProducts(account, b)"
                              >
                                <td class="px-2 py-1.5 font-mono text-gray-900" :title="b.orderId">
                                  <div>{{ b.publicId || b.orderId || '—' }}</div>
                                  <div v-if="b.likelyCause" class="mt-0.5">
                                    <span
                                      class="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium leading-tight"
                                      :class="breachCauseTone(b.likelyCause)"
                                      :title="breachCauseTooltip(b)"
                                    >
                                      {{ $t(`account.breachCause.${b.likelyCause}`) }}
                                    </span>
                                  </div>
                                </td>
                                <td class="px-2 py-1.5 text-gray-700">{{ kitchenChannelLabel(b.channelKey) }}</td>
                                <td class="px-2 py-1.5 text-right text-gray-600">{{ b.targetMinutes }}′</td>
                                <td class="px-2 py-1.5 text-right font-medium text-gray-900">{{ Math.round(b.prepMinutes) }}′</td>
                                <td class="px-2 py-1.5 text-right font-semibold text-amber-800">+{{ b.delayOverTargetMinutes }}′</td>
                                <td class="px-1 py-1.5 text-right align-middle">
                                  <span
                                    class="inline-flex items-center justify-center w-5 h-5 rounded text-gray-500 transition-colors"
                                    :class="{ 'text-gray-800': isProductsOpen(b.orderId) }"
                                    aria-hidden="true"
                                  >
                                    <span class="inline-block leading-none transition-transform duration-150" :class="{ 'rotate-90': isProductsOpen(b.orderId) }">▸</span>
                                  </span>
                                </td>
                              </tr>
                              <tr v-if="isProductsOpen(b.orderId)" class="bg-gray-50/60 border-t border-gray-100">
                                <td colspan="6" class="px-2 py-1.5">
                                  <p v-if="productStateFor(b.orderId).status === 'loading'" class="text-[10px] text-gray-500">{{ $t('account.kitchenProductsLoading') }}</p>
                                  <p v-else-if="productStateFor(b.orderId).status === 'error'" class="text-[10px] text-rose-700">{{ $t('account.kitchenProductsError') }}</p>
                                  <p v-else-if="productStateFor(b.orderId).status === 'loaded' && (productStateFor(b.orderId).products || []).length === 0" class="text-[10px] text-gray-500">{{ $t('account.kitchenProductsEmpty') }}</p>
                                  <div v-else-if="productStateFor(b.orderId).status === 'loaded'" class="flex flex-col gap-1 text-[10px] text-gray-700">
                                    <div
                                      v-for="(p, idx) in productStateFor(b.orderId).products"
                                      :key="`${b.orderId}-p-${idx}`"
                                      class="leading-tight"
                                    >
                                      <div>
                                        <span class="font-semibold text-gray-900">{{ p.quantity }}×</span> {{ p.name }}
                                      </div>
                                      <div
                                        v-if="(p.modifiers || []).length"
                                        class="pl-4 text-[10px] text-gray-500 dark:text-gray-400"
                                      >
                                        <span>{{ (p.modifiers || []).map((m) => (m.quantity > 1 ? `${m.quantity}× ${m.name}` : m.name)).join(', ') }}</span>
                                        <span v-if="p.modifiersTruncated">, …</span>
                                      </div>
                                    </div>
                                    <span
                                      v-if="productStateFor(b.orderId).productsTruncated"
                                      class="text-gray-500"
                                    >
                                      {{ $t('account.kitchenProductsMore', { n: (productStateFor(b.orderId).totalCount || 0) - (productStateFor(b.orderId).products || []).length }) }}
                                    </span>
                                  </div>
                                </td>
                              </tr>
                            </template>
                          </tbody>
                        </table>
                      </div>
                      <p v-else class="text-[11px] text-gray-500">{{ $t('account.kitchenOutOfSlaEmpty') }}</p>
                    </div>
                  </details>

                  <details v-if="kitchenSlaRanking(account).length" open class="rounded border border-gray-100">
                    <summary class="cursor-pointer list-none px-2 py-2 [&::-webkit-details-marker]:hidden">
                      <div class="flex items-center justify-between gap-2 flex-wrap">
                        <div class="flex items-center gap-1.5 min-w-0">
                          <p class="text-[11px] font-semibold text-gray-800 truncate">{{ $t('account.kitchenServiceScorecard') }}</p>
                          <span
                            class="text-gray-400 cursor-help select-none leading-none text-[11px]"
                            :title="$t('kitchenSla.rateInfoTooltip')"
                            aria-label="info"
                          >ⓘ</span>
                          <span
                            class="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none whitespace-nowrap"
                            :class="coverageTone(coverageFor(account)?.coveragePct)"
                            :title="coverageTooltipText(coverageFor(account))"
                          >
                            {{ $t('kitchenSla.coverageLabel') }}: {{ coverageLabelText(coverageFor(account)) }}
                          </span>
                        </div>
                        <p class="text-[10px] text-gray-500 shrink-0">{{ $t('companyKitchen.serviceScorecardHint') }}</p>
                      </div>
                    </summary>
                    <div class="p-2 pt-0">
                      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                        <div
                          v-for="row in kitchenSlaRanking(account)"
                          :key="row.channelKey"
                          class="rounded-lg border bg-white p-2 flex flex-col gap-1"
                          :class="onTimeBorderClass(row.onTimeRate)"
                        >
                          <div class="flex items-start justify-between gap-1">
                            <p class="text-[11px] font-semibold text-gray-800 leading-tight truncate" :title="kitchenChannelLabel(row.channelKey)">
                              {{ kitchenChannelLabel(row.channelKey) }}
                            </p>
                            <span
                              class="rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none whitespace-nowrap"
                              :class="onTimePillClass(row.onTimeRate)"
                            >
                              {{ formatPct(row.onTimeRate) }}
                            </span>
                          </div>
                          <div class="text-[10px] text-gray-600 grid grid-cols-3 gap-1 mt-0.5">
                            <div class="flex flex-col">
                              <span class="text-gray-500 leading-tight">{{ $t('companyKitchen.orders') }}</span>
                              <span class="font-semibold text-gray-900">{{ row.ordersWithPrepTime }}</span>
                            </div>
                            <div class="flex flex-col">
                              <span class="text-gray-500 leading-tight">{{ $t('account.kitchenTableGoal') }}</span>
                              <span class="font-semibold text-gray-900">{{ row.targetMinutes ?? '—' }}′</span>
                            </div>
                            <div class="flex flex-col">
                              <span class="text-gray-500 leading-tight">{{ $t('account.kitchenTableAvg') }}</span>
                              <span class="font-semibold text-gray-900">{{ formatKitchenPerformance({ averagePreparationTime: row.averagePreparationTime }) }}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </details>
                </div>
              </details>
            </div>
            <div
              v-else-if="account.success && hasOrdersApiRow(account)"
              class="bg-white border border-gray-100 rounded-lg p-3 mt-3"
            >
              <h5 class="text-xs font-medium text-gray-700 mb-1 flex items-center">
                <svg class="w-3 h-3 mr-1 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {{ $t('account.kitchenPrepSection') }}
              </h5>
              <p class="text-xs text-gray-500">{{ $t('account.kitchenNoPrepDetail') }}</p>
            </div>

                      <!-- Account Service Metrics -->
                      <div v-if="account.serviceMetrics" class="bg-white border border-gray-100 rounded-lg p-3 mt-3">
              <div class="flex items-center justify-between mb-2">
                <h5 class="text-xs font-medium text-gray-700 flex items-center">
                  <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path>
                  </svg>
                  {{ $t('account.serviceMetrics') }}
                </h5>
                <button 
                  @click="toggleServiceMetricsCollapse(account.accountKey)" 
                  class="flex items-center space-x-1 text-xs text-gray-600 hover:text-gray-900 transition-colors"
                >
                  <svg 
                    class="w-3 h-3 transition-transform" 
                    :class="{ 'rotate-180': !isServiceMetricsCollapsed(account.accountKey) }"
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                  </svg>
                  <span>{{ isServiceMetricsCollapsed(account.accountKey) ? $t('common.showDetails') : $t('common.hideDetails') }}</span>
                </button>
              </div>
              <div v-show="!isServiceMetricsCollapsed(account.accountKey)" class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div v-for="type in ['TABLE','ONSITE','TAKEAWAY','DELIVERY']" :key="type" class="bg-gray-50 rounded p-2">
                  <div class="flex items-center space-x-2 mb-1">
                    <div class="w-2 h-2 rounded-full flex-shrink-0" :style="{ backgroundColor: getServiceColor(type) }"></div>
                    <p class="font-medium text-gray-900 text-xs">{{ type }}</p>
                  </div>
                  <div class="space-y-0.5">
                    <div class="flex items-center justify-between text-xs text-gray-500">
                      <span>{{ $t('dashboard.totalOrders') }}</span>
                      <div class="text-right">
                        <span class="font-bold text-gray-900">{{ account.serviceMetrics[type]?.orders?.current_period ?? 0 }}</span>
                        <span class="text-gray-400 ml-1">({{ getAccountServiceOrderPercentage(account, type) }}%)</span>
                      </div>
                    </div>
                    <div class="flex items-center justify-between text-xs text-gray-500">
                      <span>{{ $t('rentability.revenue') }}</span>
                      <span class="font-bold text-gray-900">{{ formatCurrency(account.serviceMetrics[type]?.sales?.current_period ?? 0) }}</span>
                    </div>
                    <div class="flex items-center justify-between text-xs text-gray-500">
                      <span>{{ $t('account.avgTicket') }}</span>
                      <span class="font-bold text-gray-900">{{ formatCurrency(account.serviceMetrics[type]?.average_ticket?.current_period ?? 0) }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <!-- Service Metrics Not Available Message -->
            <div v-else-if="account.success && account.data" class="bg-white border border-gray-100 rounded-lg p-3 mt-3">
              <div class="flex items-center justify-between mb-2">
                <h5 class="text-xs font-medium text-gray-700 flex items-center">
                  <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path>
                  </svg>
                  {{ $t('account.serviceMetrics') }}
                </h5>
              </div>
              <div class="text-center py-4">
                <p class="text-xs sm:text-sm text-gray-500">{{ $t('account.serviceMetricsInfo') }}</p>
                <p class="text-xs sm:text-sm text-gray-400 mt-1">{{ $t('dashboard.switchDateRangeMessage') }}</p>
              </div>
            </div>

          </div>

          <div v-else class="text-center py-4">
            <p class="text-xs sm:text-sm text-gray-500">{{ account.error || $t('common.unableToFetchData') }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty state -->
    <div v-else class="card">
      <div class="card-body text-center text-sm text-gray-600">{{ $t('account.noAccountData') }}</div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '../stores/auth'
import { calculateDaysInPeriod as calcDays } from '../composables/useProfitability'
import Popover from './ui/Popover.vue'
import api from '../utils/api'
const props = defineProps({
  analyticsData: Object,
  ordersData: Object,
  profitabilityData: Object,
  currentDateRange: Object,
  selectedDateRange: String,
  loading: Boolean
})

const authStore = useAuthStore()
const { t } = useI18n()
const collapsedServiceMetrics = ref(new Set())

const forceRecompute = ref(0)

/* ──────────────────────────────────────────────────────────────────────────
 * SLA coverage pill
 *
 * "Coverage" = the share of orders the SLA pipeline actually counted vs. the
 * orders it had to drop because `prepared_at` was missing (waiter didn't mark
 * prep and OlaClick auto-stamped on close). We fetch it separately from the
 * account-matrix endpoint because the kitchenPerformance already attached to
 * each order doesn't carry the "dropped" denominator. One fetch per
 * date-range change keys both the per-account pills and (indirectly) the
 * company-level summary that lives in CompanyKitchenSummary.vue.
 * ────────────────────────────────────────────────────────────────────────── */
const coverageByAccount = ref({}) // { [company_token]: { ordersCount, unreliablePrepCount, coveragePct, coverageEvaluated } }

async function fetchCoverageMatrix() {
  const range = props.currentDateRange
  if (!range?.start || !range?.end) return
  try {
    const res = await api.getKitchenSlaAccountMatrix({
      startDate: range.start,
      endDate: range.end
    })
    if (!res?.success || !res.data?.accounts) {
      coverageByAccount.value = {}
      return
    }
    const next = {}
    for (const a of res.data.accounts) {
      next[a.company_token] = a.total || null
    }
    coverageByAccount.value = next
  } catch (err) {
    // Non-blocking — coverage is a nice-to-have; the main SLA scoreboard
    // still renders without it.
    console.warn('coverage matrix fetch failed', err)
  }
}

watch(
  () => `${props.currentDateRange?.start || ''}-${props.currentDateRange?.end || ''}`,
  () => fetchCoverageMatrix(),
  { immediate: true }
)

const coverageFor = (account) => {
  const key = account?.accountKey || account?.company_token
  if (!key) return null
  return coverageByAccount.value[key] || null
}

function coverageTone(pct) {
  if (pct == null) return 'bg-gray-100 text-gray-600 dark:bg-gray-700/40 dark:text-gray-300'
  if (pct >= 0.8) return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
  if (pct >= 0.5) return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
  return 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300'
}

function coverageLabelText(stats) {
  if (!stats || stats.coverageEvaluated == null || stats.coveragePct == null) {
    return t('kitchenSla.coverageNoData')
  }
  return `${Math.round(stats.coveragePct * 100)}%`
}

function coverageTooltipText(stats) {
  if (!stats || stats.coverageEvaluated == null) {
    return t('kitchenSla.coverageTooltip')
  }
  return t('kitchenSla.coverageDenominator', {
    counted: stats.ordersCount || 0,
    total: stats.coverageEvaluated || 0,
    dropped: stats.unreliablePrepCount || 0
  })
}

const isDesktop = ref(true)
let kpiMediaQuery
function applyKpiMedia() {
  isDesktop.value = window.matchMedia('(min-width: 1024px)').matches
}
onMounted(() => {
  applyKpiMedia()
  kpiMediaQuery = window.matchMedia('(min-width: 1024px)')
  kpiMediaQuery.addEventListener('change', applyKpiMedia)
})
onBeforeUnmount(() => {
  if (kpiMediaQuery) kpiMediaQuery.removeEventListener('change', applyKpiMedia)
})

const paymentMethodColors = {
  'cash': '#10B981',
  'card': '#3B82F6', 
  'bitcoin': '#F59E0B',
  'yape': '#8B5CF6',
  'plin': '#06B6D4',
  'transfer': '#EF4444'
}

// Server provides profitability; no client-side cost fetching required

// Helper to get server profitability data for this account
const getServerAccount = (account) => {
  return props.profitabilityData?.accounts?.find(a => a.accountKey === account.accountKey)
}

// Daily/period gain from server - CONVERTED TO COMPUTED PROPERTY
const getAccountDailyGain = (account) => {
  // Access the trigger to ensure reactivity
  const trigger = forceRecompute.value
  // Use the reactive computed property for consistency
  const breakdown = accountBreakdowns.value.get(account.accountKey)
  
  console.log(`💰 getAccountDailyGain for ${account.accountKey}:`, {
    finalGain: breakdown?.finalGain || 0,
    forceRecomputeTrigger: trigger
  })
  
  return breakdown?.finalGain || 0
}

// Create reactive computed properties for each account's daily gain
const accountDailyGains = computed(() => {
  const gains = new Map()
  
  if (!props.analyticsData?.accounts) return gains
  
  props.analyticsData.accounts.forEach(account => {
    gains.set(account.accountKey, getAccountDailyGain(account))
  })
  
  return gains
})

// Calculate number of days in the current date range
const calculateDaysInPeriod = () => calcDays(props.currentDateRange)

// Format gain period label based on selected date range and number of days
const formatGainPeriodLabel = () => {
  const daysInPeriod = calcDays(props.currentDateRange)
  
  if (props.selectedDateRange === 'today') {
    return 'Daily'
  } else if (daysInPeriod === 1) {
    return 'Daily'
  } else if (daysInPeriod <= 7) {
    return `${daysInPeriod}-Day`
  } else if (daysInPeriod <= 31) {
    return `${daysInPeriod}-Day`
  } else {
    return 'Period'
  }
}

// Watch for profitability data changes and force re-computation
watch(
  [() => props.profitabilityData, () => props.currentDateRange],
  (newValues, oldValues) => {
    const [newProfitabilityData, newDateRange] = newValues
    const [oldProfitabilityData, oldDateRange] = oldValues
    
    console.log('👀 Profitability data watcher triggered:', {
      profitabilityChanged: newProfitabilityData !== oldProfitabilityData,
      dateRangeChanged: newDateRange !== oldDateRange,
      newPeriod: newProfitabilityData?.period,
      oldPeriod: oldProfitabilityData?.period,
      newTimestamp: newProfitabilityData?.timestamp,
      oldTimestamp: oldProfitabilityData?.timestamp
    })
    
    // Force recomputation
    forceRecompute.value++
  },
  { deep: true, immediate: false }
)

// Ensure reactivity on analytics/orders/selected range changes as well
watch(
  [() => props.analyticsData, () => props.ordersData, () => props.selectedDateRange, () => props.currentDateRange],
  (newValues, oldValues) => {
    const [newAnalytics, newOrders, newSelectedRange, newCurrentRange] = newValues
    const [oldAnalytics, oldOrders, oldSelectedRange, oldCurrentRange] = oldValues
    console.log('👀 Analytics/Orders/Range watcher triggered:', {
      analyticsChanged: newAnalytics !== oldAnalytics,
      ordersChanged: newOrders !== oldOrders,
      selectedRangeChanged: newSelectedRange !== oldSelectedRange,
      currentRangeChanged: newCurrentRange !== oldCurrentRange
    })
    forceRecompute.value++
  },
  { deep: true, immediate: false }
)

// Create a reactive computed property for account gain breakdowns
const accountGainBreakdowns = computed(() => {
  const map = new Map()
  
  if (!props.analyticsData?.accounts) return map
  
  // Explicitly access all reactive props to ensure reactivity
  const profitabilityData = props.profitabilityData
  const currentDateRange = props.currentDateRange
  const analyticsData = props.analyticsData
  const trigger = forceRecompute.value // Access the trigger to force reactivity

  // Use server profitability only when its period matches the current date range
  const pdStart = profitabilityData?.period?.start
  const pdEnd = profitabilityData?.period?.end
  const curStart = currentDateRange?.start
  const curEnd = currentDateRange?.end
  const profitabilityInSync = !!(pdStart && pdEnd && curStart && curEnd && pdStart === curStart && pdEnd === curEnd)
  
  // Debug log to track profitability data changes
  console.log('🔄 AccountDetails: Computing gain breakdowns', {
    profitabilityDataPeriod: profitabilityData?.period,
    profitabilityInSync,
    currentDateRange: currentDateRange,
    profitabilityAccounts: profitabilityData?.accounts?.length || 0,
    profitabilityTimestamp: profitabilityData?.timestamp,
    analyticsTimestamp: analyticsData.timestamp,
    forceRecomputeTrigger: trigger
  })
  
  analyticsData.accounts.forEach(account => {
    
    const serverAcc = profitabilityData?.accounts?.find(a => a.accountKey === account.accountKey)
    
    // Calculate client-side revenue first for comparison
    let clientSideRevenue = 0
    let clientSidePaymentMethods = []
    if (account.success && account.data?.data) {
      // Get payment method costs from profitability data if available
      const serverPaymentCosts = new Map()
      if (serverAcc?.paymentMethodBreakdown) {
        serverAcc.paymentMethodBreakdown.forEach(pm => {
          serverPaymentCosts.set(pm.method, pm.costConfig || { cost_percentage: 0, fixed_cost: 0 })
        })
      }
      
      clientSidePaymentMethods = (account.data.data || []).map(pm => {
        const methodName = pm.name?.toLowerCase() || 'other'
        const revenue = pm.sum || 0
        const transactionCount = pm.count || 0
        const costConfig = serverPaymentCosts.get(methodName) || { cost_percentage: 0, fixed_cost: 0 }
        const percentageFee = revenue * (costConfig.cost_percentage / 100)
        const fixedFee = transactionCount * (costConfig.fixed_cost || 0)
        const fees = percentageFee + fixedFee
        
        return {
          method: methodName,
          revenue,
          fees,
          netRevenue: revenue - fees,
          transactionCount,
          costConfig
        }
      })
      clientSideRevenue = clientSidePaymentMethods.reduce((s, m) => s + (m.revenue || 0), 0)
    }
    
    if (serverAcc) {
      // Prefer hybrid: current-period revenue with server-side costs when we have revenue
      if (clientSideRevenue > 0) {
        // Derive utility costs for the selected period using server per-period or per-day if mismatched
        const currentDays = calcDays(currentDateRange) || 1
        const serverDays = serverAcc?.daysInPeriod || currentDays
        const serverUtilTotal = serverAcc?.utilityCosts || 0
        const utilityPerDay = serverDays > 0 ? (serverUtilTotal / serverDays) : serverUtilTotal
        const utilityCostsForPeriod = utilityPerDay * currentDays
        // Derive payroll entries scaled to period
        const serverEntries = serverAcc?.payrollEntries || 0
        const entriesPerDay = serverDays > 0 ? (serverEntries / serverDays) : serverEntries
        const payrollEntriesForPeriod = Math.round(entriesPerDay * currentDays)
        // Use hybrid approach: client-side revenue with server-side costs
        // Calculate payment fees from client-side payment methods
        const paymentFees = clientSidePaymentMethods.reduce((sum, method) => sum + (method.fees || 0), 0)
        const netRevenue = clientSideRevenue - paymentFees
        const foodCosts = netRevenue * 0.3
        const totalCosts = paymentFees + foodCosts + utilityCostsForPeriod + (serverAcc.payrollCosts || 0)
        
        console.log(`🔄 Using hybrid data for ${account.accountKey}:`, {
          clientSideRevenue,
          paymentFees,
          serverPayrollCosts: serverAcc.payrollCosts,
          serverUtilityCosts: serverAcc.utilityCosts,
          calculatedFoodCosts: foodCosts,
          clientSidePaymentMethods
        })
        
        map.set(account.accountKey, {
          totalRevenue: clientSideRevenue,
          totalCosts,
          paymentFees,
          foodCosts,
          utilityCosts: utilityCostsForPeriod,
          payrollCosts: serverAcc.payrollCosts || 0,
          payrollEntries: payrollEntriesForPeriod,
          finalGain: clientSideRevenue - totalCosts,
          daysInPeriod: calcDays(currentDateRange) || 1,
          paymentMethodBreakdown: clientSidePaymentMethods
        })
        return
      }

      // Fallback to server-only figures when no client-side revenue is available
      console.log(`💰 Using server-only profitability for ${account.accountKey}:`, {
        operatingProfit: serverAcc.operatingProfit,
        grossSales: serverAcc.grossSales,
        paymentFees: serverAcc.paymentFees,
        payrollCosts: serverAcc.payrollCosts,
        payrollEntries: serverAcc.payrollEntries,
        utilityCosts: serverAcc.utilityCosts
      })
      const currentDays = calcDays(currentDateRange) || 1
      const serverDays = serverAcc?.daysInPeriod || currentDays
      const serverUtilTotal = serverAcc?.utilityCosts || 0
      const utilityPerDay = serverDays > 0 ? (serverUtilTotal / serverDays) : serverUtilTotal
      const utilityCostsForPeriod = utilityPerDay * currentDays
      // Scale entries to selected days
      const serverEntries = serverAcc?.payrollEntries || 0
      const entriesPerDay = serverDays > 0 ? (serverEntries / serverDays) : serverEntries
      const payrollEntriesForPeriod = Math.round(entriesPerDay * currentDays)
      map.set(account.accountKey, {
        totalRevenue: serverAcc.grossSales || 0,
        totalCosts: (serverAcc.paymentFees || 0) + (serverAcc.foodCosts || 0) + utilityCostsForPeriod + (serverAcc.payrollCosts || 0),
        paymentFees: serverAcc.paymentFees || 0,
        foodCosts: serverAcc.foodCosts || 0,
        utilityCosts: utilityCostsForPeriod,
        payrollCosts: serverAcc.payrollCosts || 0,
        payrollEntries: payrollEntriesForPeriod,
        finalGain: (serverAcc.grossSales || 0) - ((serverAcc.paymentFees || 0) + (serverAcc.foodCosts || 0) + utilityCostsForPeriod + (serverAcc.payrollCosts || 0)),
        daysInPeriod: calcDays(currentDateRange) || 1,
        paymentMethodBreakdown: serverAcc.paymentMethodBreakdown || []
      })
      return
    }

    
    
    if (!account.success || !account.data?.data) {
      map.set(account.accountKey, {
        totalRevenue: 0,
        totalCosts: 0,
        paymentFees: 0,
        foodCosts: 0,
        utilityCosts: 0,
        finalGain: 0,
        daysInPeriod: calcDays(currentDateRange),
        paymentMethodBreakdown: []
      })
      return
    }
    
    // Fallback to pure client-side calculation
    const daysInPeriod = calcDays(currentDateRange)
    const totalRevenue = clientSideRevenue
    const paymentFees = clientSidePaymentMethods.reduce((sum, method) => sum + (method.fees || 0), 0)
    const netRevenue = totalRevenue - paymentFees
    const foodCosts = netRevenue * 0.3
    const utilityCosts = 0
    const totalCosts = paymentFees + foodCosts + utilityCosts
    const finalGain = totalRevenue - totalCosts
    
    console.log(`🎯 Using pure client-side data for ${account.accountKey}:`, {
      totalRevenue,
      paymentFees,
      foodCosts,
      finalGain,
      clientSidePaymentMethods
    })
    
    map.set(account.accountKey, {
      totalRevenue,
      totalCosts,
      paymentFees,
      foodCosts,
      utilityCosts,
      payrollCosts: 0,
      payrollEntries: 0,
      finalGain,
      daysInPeriod,
      paymentMethodBreakdown: clientSidePaymentMethods
    })
  })
  
  return map
})

// Get detailed gain breakdown for tooltip - ENHANCED FOR REACTIVITY
const getAccountGainBreakdown = (account) => {
  // Access the trigger to ensure reactivity
  const trigger = forceRecompute.value
  
  const result = accountGainBreakdowns.value.get(account.accountKey) || {
    totalRevenue: 0,
    totalCosts: 0,
    paymentFees: 0,
    foodCosts: 0,
    utilityCosts: 0,
    payrollCosts: 0,
    payrollEntries: 0,
    finalGain: 0,
    daysInPeriod: 1,
    paymentMethodBreakdown: []
  }
  
  console.log(`🔄 getAccountGainBreakdown for ${account.accountKey}:`, {
    finalGain: result.finalGain,
    totalRevenue: result.totalRevenue,
    totalCosts: result.totalCosts,
    paymentFees: result.paymentFees,
    paymentMethodBreakdown: result.paymentMethodBreakdown,
    forceRecomputeTrigger: trigger
  })
  
  return result
}

// Create reactive computed properties for each account's breakdown to ensure reactivity in popover
const accountBreakdowns = computed(() => {
  const breakdowns = new Map()
  
  if (!props.analyticsData?.accounts) return breakdowns
  
  props.analyticsData.accounts.forEach(account => {
    breakdowns.set(account.accountKey, getAccountGainBreakdown(account))
  })
  
  return breakdowns
})

// Get CSS class for daily gain (green for positive, red for negative)
const getDailyGainClass = (account) => {
  if (isAccountGainDisabled()) return 'text-gray-400'
  const gain = accountDailyGains.value.get(account.accountKey) || 0
  if (gain > 0) return 'text-green-600'
  if (gain < 0) return 'text-red-600'
  return 'text-gray-600'
}

const isAccountGainDisabled = () => {
  // Always enabled; server now includes projected payroll for open entries
  return false
}

const formatCurrency = (amount) => {
  const currencySymbol = authStore.user?.currencySymbol || 'S/'
  const num = Number(amount) || 0
  return `${currencySymbol} ${num.toFixed(2)}`
}

const getPaymentMethodColor = (methodName) => {
  return paymentMethodColors[methodName.toLowerCase()] || '#6B7280'
}

const getServiceColor = (serviceType) => {
  const colors = {
    'TABLE': '#4F46E5', // Indigo
    'ONSITE': '#10B981', // Green
    'TAKEAWAY': '#F59E0B', // Amber
    'DELIVERY': '#EF4444', // Red
    'OTHER': '#6B7280'
  }
  return colors[serviceType] || '#6B7280' // Default color
}



const getAccountTotalAmount = (account) => {
  if (!account.success || !account.data?.data) return 0
  return account.data.data.reduce((sum, method) => sum + (method.sum || 0), 0)
}

const getAccountTotalTips = (account) => {
  if (!account.success || !account.tipsData?.success || !account.tipsData.data?.data) return 0
  return account.tipsData.data.data.reduce((sum, tip) => sum + (tip.sum || 0), 0)
}

const getAccountKitchenPerformance = (account) => {
  const empty = {
    averagePreparationTime: 0,
    ordersWithPrepTime: 0,
    byServiceType: {},
    byKitchenChannel: {},
    byDay: [],
    sla: null
  }
  if (!account.success) return { ...empty }

  if (props.ordersData && props.ordersData.accounts) {
    const accountData = props.ordersData.accounts.find(acc => acc.accountKey === account.accountKey)
    if (accountData && accountData.kitchenPerformance) {
      return { ...empty, ...accountData.kitchenPerformance }
    }
  }

  return { ...empty }
}

const hasOrdersApiRow = (account) => {
  return !!(props.ordersData?.accounts?.some(a => a.accountKey === account.accountKey))
}

const hasKitchenBreakdown = (account) => {
  return getAccountKitchenPerformance(account).ordersWithPrepTime > 0
}

const kitchenSlaRanking = (account) => {
  return getAccountKitchenPerformance(account).sla?.channelRanking || []
}

const slaBreachesForAccount = (account) => {
  return getAccountKitchenPerformance(account).sla?.slaBreaches || []
}

const slaBreachTruncNote = (account) => {
  return !!getAccountKitchenPerformance(account).sla?.slaBreachesTruncated
}

/**
 * Per-orderId state for the SLA-breach product drill-down. Lazy: we only call
 * the server when an operator clicks the chevron, and we cache the response so
 * collapse / re-expand is instant. Keyed by OlaClick order UUID; the publicId
 * is shown in the row but the API needs the UUID.
 */
const productState = reactive({})

const productStateFor = (orderId) => {
  if (!orderId) return { status: 'idle', products: [], productsTruncated: false, totalCount: 0 }
  return productState[orderId] || { status: 'idle', products: [], productsTruncated: false, totalCount: 0 }
}

const isProductsOpen = (orderId) => {
  if (!orderId) return false
  return !!productState[orderId]?.open
}

async function toggleProducts(account, breach) {
  const orderId = breach?.orderId
  if (!orderId) return
  const existing = productState[orderId]
  if (existing?.open) {
    existing.open = false
    return
  }
  if (!existing) {
    productState[orderId] = {
      open: true,
      status: 'loading',
      products: [],
      productsTruncated: false,
      totalCount: 0
    }
  } else {
    existing.open = true
    if (existing.status === 'loaded' || existing.status === 'error') {
      // We have a cached response — no need to refetch.
      return
    }
    existing.status = 'loading'
  }

  const companyToken = account?.accountKey || account?.company_token
  if (!companyToken) {
    productState[orderId] = {
      ...productState[orderId],
      open: true,
      status: 'error'
    }
    return
  }

  try {
    const payload = await api.getOrderProducts(companyToken, orderId)
    productState[orderId] = {
      open: true,
      status: 'loaded',
      products: payload?.products || [],
      productsTruncated: !!payload?.productsTruncated,
      totalCount: payload?.totalCount || (payload?.products?.length || 0)
    }
  } catch (err) {
    console.error('Failed to load order products', err)
    productState[orderId] = {
      open: true,
      status: 'error',
      products: [],
      productsTruncated: false,
      totalCount: 0
    }
  }
}

// Color cues for the per-service scorecard. Thresholds match the company-wide
// summary so users can scan red/amber/green tiles consistently across the
// dashboard without re-learning the scale.
function onTimePillClass(r) {
  if (r == null) return 'bg-gray-100 text-gray-700'
  if (r >= 0.9) return 'bg-emerald-100 text-emerald-800'
  if (r >= 0.7) return 'bg-amber-100 text-amber-800'
  return 'bg-rose-100 text-rose-800'
}

function onTimeBorderClass(r) {
  if (r == null) return 'border-gray-100'
  if (r >= 0.9) return 'border-emerald-200/80'
  if (r >= 0.7) return 'border-amber-200/80'
  return 'border-rose-200/80'
}

const kitchenSlaScore = (account) => {
  const s = getAccountKitchenPerformance(account).sla
  if (!s || !s.totalScoredOrders) return null
  return s.overallSlaScore
}

const kitchenOnTimePct = (account) => {
  const s = getAccountKitchenPerformance(account).sla
  if (!s || !s.totalScoredOrders) return ''
  const pct = Math.round((s.overallOnTimeRate || 0) * 100)
  return t('account.kitchenOnTimeLine', { pct })
}

const formatPct = (r) => {
  if (r == null || Number.isNaN(r)) return '—'
  return `${Math.round(r * 100)}%`
}

const kitchenChannelLabel = (key) => {
  const flat = key.replace(/:/g, '_')
  const path = `account.kitchenChannelKeys.${flat}`
  const translated = t(path)
  if (translated !== path) return translated
  const parts = key.split(':')
  if (parts.length >= 2) return `${parts[0]} · ${parts[1]}`
  return key
}

// Server-classified breach root cause — visual tone matches the severity
// hinted at server-side (rose = waiter forgot to mark prep, amber = order
// sat ready, slate = likely real kitchen delay). Keep these in lockstep with
// the classifyBreachCause severities in `server/services/olaClickService.js`.
const BREACH_CAUSE_TONES = {
  marked_at_close: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
  order_sat_ready: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  kitchen_delay_likely: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
}

function breachCauseTone(cause) {
  return BREACH_CAUSE_TONES[cause] || 'bg-gray-100 text-gray-700 dark:bg-gray-700/40 dark:text-gray-300'
}

// Tooltip prefers the per-cause string with the supporting delta interpolated
// (e.g. "marcado solo 2 min antes del cierre"). If `causeMeta` doesn't carry
// the relevant number (NaN / null — should only happen on the fallback
// `kitchen_delay_likely` branch or on partial timestamp data) we fall back to
// the generic copy so the chip is never silently empty.
function breachCauseTooltip(breach) {
  if (!breach?.likelyCause) return ''
  const cause = breach.likelyCause
  const meta = breach.causeMeta || {}
  const minutes = Number(meta.closeToPreparedMinutes)
  const hasMinutes = Number.isFinite(minutes)

  if (cause === 'marked_at_close') {
    if (hasMinutes) {
      return t('account.breachCause.marked_at_close_tooltip', { minutes: minutes.toFixed(1) })
    }
    return t('account.breachCause.marked_at_close_tooltip_generic')
  }
  if (cause === 'order_sat_ready') {
    if (hasMinutes) {
      return t('account.breachCause.order_sat_ready_tooltip', { minutes: minutes.toFixed(1) })
    }
    return t('account.breachCause.order_sat_ready_tooltip_generic')
  }
  if (cause === 'kitchen_delay_likely') {
    return t('account.breachCause.kitchen_delay_likely_tooltip')
  }
  return ''
}

const formatKitchenPerformance = (performanceData) => {
  if (!performanceData || performanceData.averagePreparationTime === 0) {
    return 'N/A'
  }
  
  const avgMinutes = performanceData.averagePreparationTime
  
  if (avgMinutes < 60) {
    return `${Math.round(avgMinutes)}m`
  } else {
    const hours = Math.floor(avgMinutes / 60)
    const minutes = Math.round(avgMinutes % 60)
    return `${hours}h ${minutes}m`
  }
}

const getAccountTotalOrders = (account) => {
  if (!account.success) return 0
  
  // Use the new simplified orders data structure
  if (props.ordersData && props.ordersData.accounts) {
    const accountData = props.ordersData.accounts.find(acc => acc.accountKey === account.accountKey)
    if (accountData) {
      return accountData.orders || 0
    }
  }
  
  return 0
}

const getAccountAvgTicket = (account) => {
  if (!account.success || !account.data?.data) return 0
  const totalAmount = account.data.data.reduce((sum, method) => sum + (method.sum || 0), 0)
  const totalOrders = account.data.data.reduce((sum, method) => sum + (method.count || 0), 0)
  return totalOrders > 0 ? totalAmount / totalOrders : 0
}

// Payment fees from server
const getAccountPaymentFees = (account) => getServerAccount(account)?.paymentFees || 0

// Net sales after fees
const getAccountNetSalesAfterFees = (account) => getServerAccount(account)?.netAfterFees || 0

// Operating margin = operating profit / gross
const getAccountOperatingMargin = (account) => getServerAccount(account)?.operatingMargin || 0

// Profit per order
const getAccountProfitPerOrder = (account) => {
  const acc = getServerAccount(account)
  const orders = acc?.orders ?? 0
  if (orders <= 0) return 0
  return (acc?.operatingProfit || 0) / orders
}

const getAccountPaymentMethods = (account) => {
  if (!account.success || !account.data?.data) return []
  const totalSum = account.data.data.reduce((sum, method) => sum + (method.sum || 0), 0)
  return account.data.data.map(method => ({
    name: method.name,
    sum: method.sum,
    count: method.count,
    percent: totalSum > 0 ? (method.sum / totalSum) * 100 : 0
  })).sort((a, b) => b.sum - a.sum) // Sort by sum descending
}

const getAccountServiceOrderPercentage = (account, serviceType) => {
  if (!account.serviceMetrics || !account.serviceMetrics[serviceType]) {
    return 0
  }

  // Calculate total orders for this account across all services
  const accountTotalOrders = ['TABLE', 'ONSITE', 'TAKEAWAY', 'DELIVERY'].reduce((total, type) => {
    return total + (account.serviceMetrics[type]?.orders?.current_period ?? 0)
  }, 0)

  const serviceOrders = account.serviceMetrics[serviceType]?.orders?.current_period ?? 0
  
  return accountTotalOrders > 0 ? ((serviceOrders / accountTotalOrders) * 100).toFixed(1) : '0.0'
}



const isServiceMetricsCollapsed = (accountKey) => {
  return collapsedServiceMetrics.value.has(accountKey)
}

const toggleServiceMetricsCollapse = (accountKey) => {
  if (collapsedServiceMetrics.value.has(accountKey)) {
    collapsedServiceMetrics.value.delete(accountKey)
  } else {
    collapsedServiceMetrics.value.add(accountKey)
  }
}

// No watchers required


</script>

<style scoped>
.badge-success {
  @apply bg-green-100 text-green-800;
}

.badge-danger {
  @apply bg-red-100 text-red-800;
}
</style>
