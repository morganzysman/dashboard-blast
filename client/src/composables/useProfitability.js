// Shared profitability/calculation utilities for accounts and company-level aggregation

// Calculate number of days in a selected date range
export function calculateDaysInPeriod(currentDateRange) {
  if (!currentDateRange || !currentDateRange.start || !currentDateRange.end) {
    return 1
  }
  const startDate = new Date(currentDateRange.start)
  const endDate = new Date(currentDateRange.end)
  const timeDiff = endDate.getTime() - startDate.getTime()
  const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1
  return Math.max(1, daysDiff)
}

// Compute payment processing fees for a single account based on configured costs
export function computeAccountPaymentFees(account, paymentMethodCostsMap) {
  if (!account?.success || !account?.data?.data) return 0
  const accountPaymentCosts = paymentMethodCostsMap?.get(account.accountKey) || new Map()
  let fees = 0
  for (const paymentMethod of account.data.data) {
    const methodName = paymentMethod.name?.toLowerCase() || 'other'
    const revenue = paymentMethod.sum || 0
    const transactionCount = paymentMethod.count || 0
    const costConfig = accountPaymentCosts.get(methodName) || { cost_percentage: 0, fixed_cost: 0 }
    const percentageFee = revenue * (costConfig.cost_percentage / 100)
    const fixedFee = transactionCount * (costConfig.fixed_cost || 0)
    fees += percentageFee + fixedFee
  }
  return fees
}

// Compute gross sales for account
export function computeAccountGrossSales(account) {
  if (!account?.success || !account?.data?.data) return 0
  return account.data.data.reduce((sum, method) => sum + (method.sum || 0), 0)
}

// Compute total orders for account (from serviceMetrics where available)
export function computeAccountOrders(account) {
  if (!account?.success) return 0
  if (account.serviceMetrics) {
    return Object.values(account.serviceMetrics).reduce((sum, service) => sum + (service?.orders?.current_period ?? 0), 0)
  }
  return 0
}

// Compute account daily/period gain
export function computeAccountGain(account, paymentMethodCostsMap, utilityCostsMap, currentDateRange, foodCostRate = 0.3) {
  if (!account?.success || !account?.data?.data) return 0
  const daysInPeriod = calculateDaysInPeriod(currentDateRange)
  const totalRevenue = computeAccountGrossSales(account)
  const paymentFees = computeAccountPaymentFees(account, paymentMethodCostsMap)
  const revenueAfterFees = totalRevenue - paymentFees
  const foodCosts = totalRevenue * (foodCostRate ?? 0)
  const revenueAfterFoodCosts = revenueAfterFees - foodCosts
  const utilityCost = utilityCostsMap?.get(account.accountKey)
  const dailyUtilityCost = utilityCost ? (utilityCost.total_daily || 0) : 0
  const totalUtilityCosts = dailyUtilityCost * daysInPeriod
  return revenueAfterFoodCosts - totalUtilityCosts
}

// Detailed breakdown per account (for tooltips)
export function computeAccountGainBreakdown(account, paymentMethodCostsMap, utilityCostsMap, currentDateRange, foodCostRate = 0.3) {
  if (!account?.success || !account?.data?.data) {
    return {
      totalRevenue: 0,
      totalCosts: 0,
      paymentFees: 0,
      foodCosts: 0,
      utilityCosts: 0,
      finalGain: 0,
      daysInPeriod: 1,
      paymentMethodBreakdown: []
    }
  }

  const daysInPeriod = calculateDaysInPeriod(currentDateRange)
  const accountPaymentCosts = paymentMethodCostsMap?.get(account.accountKey) || new Map()

  let totalRevenue = 0
  let totalPaymentFees = 0
  const paymentMethodBreakdown = []

  for (const paymentMethod of account.data.data) {
    const methodName = paymentMethod.name?.toLowerCase() || 'other'
    const revenue = paymentMethod.sum || 0
    const transactionCount = paymentMethod.count || 0
    const costConfig = accountPaymentCosts.get(methodName) || { cost_percentage: 0, fixed_cost: 0 }
    const percentageFee = revenue * (costConfig.cost_percentage / 100)
    const fixedFee = transactionCount * (costConfig.fixed_cost || 0)
    const totalFees = percentageFee + fixedFee
    const netRevenue = revenue - totalFees

    totalRevenue += revenue
    totalPaymentFees += totalFees

    paymentMethodBreakdown.push({
      method: methodName,
      revenue,
      fees: totalFees,
      netRevenue,
      transactionCount,
      costConfig
    })
  }

  const foodCosts = totalRevenue * (foodCostRate ?? 0)
  const utilityCost = utilityCostsMap?.get(account.accountKey)
  const dailyUtilityCost = utilityCost ? (utilityCost.total_daily || 0) : 0
  const totalUtilityCosts = dailyUtilityCost * daysInPeriod
  const totalCosts = totalPaymentFees + foodCosts + totalUtilityCosts
  const finalGain = totalRevenue - totalCosts

  return {
    totalRevenue,
    totalCosts,
    paymentFees: totalPaymentFees,
    foodCosts,
    utilityCosts: totalUtilityCosts,
    finalGain,
    daysInPeriod,
    paymentMethodBreakdown
  }
}

// Company aggregation across accounts
export function aggregateCompany(accounts, paymentMethodCostsMap, utilityCostsMap, currentDateRange, foodCostRate = 0.3) {
  const safeAccounts = Array.isArray(accounts) ? accounts : []
  let grossSales = 0
  let paymentFees = 0
  let foodCosts = 0
  let utilityCosts = 0
  let operatingProfit = 0
  let tips = 0

  const daysInPeriod = calculateDaysInPeriod(currentDateRange)

  for (const acc of safeAccounts) {
    const gross = computeAccountGrossSales(acc)
    const fees = computeAccountPaymentFees(acc, paymentMethodCostsMap)
    const food = gross * (foodCostRate ?? 0)
    const util = (utilityCostsMap?.get(acc.accountKey)?.total_daily || 0) * daysInPeriod
    const gain = computeAccountGain(acc, paymentMethodCostsMap, utilityCostsMap, currentDateRange, foodCostRate)

    grossSales += gross
    paymentFees += fees
    foodCosts += food
    utilityCosts += util
    operatingProfit += gain

    if (acc.tipsData?.success && acc.tipsData.data?.data) {
      tips += acc.tipsData.data.data.reduce((s, t) => s + (t.sum || 0), 0)
    }
  }

  const netAfterFees = grossSales - paymentFees
  const operatingMargin = grossSales > 0 ? operatingProfit / grossSales : 0
  const feeRate = grossSales > 0 ? paymentFees / grossSales : 0
  const tipRate = grossSales > 0 ? tips / grossSales : 0

  return {
    grossSales,
    paymentFees,
    netAfterFees,
    foodCosts,
    utilityCosts,
    operatingProfit,
    operatingMargin,
    feeRate,
    tips,
    tipRate
  }
}

// Distributions across payment methods
export function distributionFeesByMethod(accounts, paymentMethodCostsMap) {
  const feesByMethod = {}
  const safeAccounts = Array.isArray(accounts) ? accounts : []
  for (const acc of safeAccounts) {
    if (!acc?.success || !acc?.data?.data) continue
    const accountPaymentCosts = paymentMethodCostsMap?.get(acc.accountKey) || new Map()
    for (const pm of acc.data.data) {
      const methodName = pm.name?.toLowerCase() || 'other'
      const revenue = pm.sum || 0
      const transactionCount = pm.count || 0
      const costConfig = accountPaymentCosts.get(methodName) || { cost_percentage: 0, fixed_cost: 0 }
      const percentageFee = revenue * (costConfig.cost_percentage / 100)
      const fixedFee = transactionCount * (costConfig.fixed_cost || 0)
      const totalFees = percentageFee + fixedFee
      feesByMethod[methodName] = (feesByMethod[methodName] || 0) + totalFees
    }
  }
  return feesByMethod
}

export function distributionNetRevenueByMethod(accounts, paymentMethodCostsMap) {
  const netByMethod = {}
  const safeAccounts = Array.isArray(accounts) ? accounts : []
  for (const acc of safeAccounts) {
    if (!acc?.success || !acc?.data?.data) continue
    const accountPaymentCosts = paymentMethodCostsMap?.get(acc.accountKey) || new Map()
    for (const pm of acc.data.data) {
      const methodName = pm.name?.toLowerCase() || 'other'
      const revenue = pm.sum || 0
      const transactionCount = pm.count || 0
      const costConfig = accountPaymentCosts.get(methodName) || { cost_percentage: 0, fixed_cost: 0 }
      const percentageFee = revenue * (costConfig.cost_percentage / 100)
      const fixedFee = transactionCount * (costConfig.fixed_cost || 0)
      const totalFees = percentageFee + fixedFee
      const netRevenue = revenue - totalFees
      netByMethod[methodName] = (netByMethod[methodName] || 0) + netRevenue
    }
  }
  return netByMethod
}

