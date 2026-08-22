import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { payModeForContracts } from './payMode.js'

describe('payModeForContracts', () => {
  it('defaults to hourly when the employee has no contracts', () => {
    assert.equal(payModeForContracts([]), 'hourly')
    assert.equal(payModeForContracts(null), 'hourly')
  })

  it('keeps hourly pay for locación / service contracts', () => {
    assert.equal(
      payModeForContracts([
        { status: 'active', country: 'PE', contract_type: 'locacion' },
      ]),
      'hourly'
    )
  })

  it('switches to monthly for Planilla — Régimen REMYPE (microempresa)', () => {
    assert.equal(
      payModeForContracts([
        { status: 'active', country: 'PE', contract_type: 'microempresa' },
      ]),
      'monthly'
    )
  })

  it('switches to monthly for Planilla — Régimen normal and other employment types', () => {
    assert.equal(
      payModeForContracts([{ status: 'active', country: 'PE', contract_type: 'planilla' }]),
      'monthly'
    )
    assert.equal(
      payModeForContracts([{ status: 'active', country: 'CO', contract_type: 'laboral' }]),
      'monthly'
    )
  })

  it('treats an expired employment contract as monthly when nothing else is live', () => {
    assert.equal(
      payModeForContracts([
        { status: 'expired', country: 'PE', contract_type: 'microempresa' },
      ]),
      'monthly'
    )
  })

  it('prefers the live (active / awaiting worker) contract over an expired one', () => {
    assert.equal(
      payModeForContracts([
        { status: 'expired', country: 'PE', contract_type: 'microempresa' },
        { status: 'active', country: 'PE', contract_type: 'locacion' },
      ]),
      'hourly'
    )
  })

  it('treats awaiting_worker employment as monthly so pay does not flash as hourly before they sign', () => {
    assert.equal(
      payModeForContracts([
        { status: 'awaiting_worker', country: 'PE', contract_type: 'microempresa' },
      ]),
      'monthly'
    )
  })

  it('uses category when present so the client does not need the country registry', () => {
    assert.equal(
      payModeForContracts([{ status: 'active', category: 'employment' }]),
      'monthly'
    )
    assert.equal(
      payModeForContracts([{ status: 'active', category: 'service' }]),
      'hourly'
    )
  })
})
