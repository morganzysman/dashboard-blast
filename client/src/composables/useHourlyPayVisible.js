import { ref, computed, onMounted } from 'vue'
import api from '../utils/api'

/**
 * Employee-facing pay UI: contractors (locación / service) see hours × rate;
 * monthly salary contracts (planilla, REMYPE/microempresa, CLT, …) see hours only.
 *
 * `showHourlyPay` is false until the contracts call returns so a REMYPE
 * employee does not flash an earned total. A failed fetch falls back to
 * hourly (the previous default) rather than hiding pay forever.
 */
export function useHourlyPayVisible() {
  const payMode = ref(null)
  const showHourlyPay = computed(() => payMode.value === 'hourly')

  const load = async () => {
    try {
      const res = await api.getMyContracts()
      payMode.value = res?.pay_mode === 'monthly' ? 'monthly' : 'hourly'
    } catch {
      payMode.value = 'hourly'
    }
  }

  onMounted(load)
  return { payMode, showHourlyPay, reload: load }
}
