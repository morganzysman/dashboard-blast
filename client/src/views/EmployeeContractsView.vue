<template>
  <div class="space-y-4 lg:space-y-6 max-w-3xl mx-auto">
    <!-- Prompt employee to complete contract identity data if missing -->
    <ContractInfoPrompt />
    <ContractSignPrompt ref="signPrompt" @signed="contractsCard?.reload()" />

    <MyContractsCard ref="contractsCard" @sign="onSignContract" />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import ContractInfoPrompt from '../components/ContractInfoPrompt.vue'
import ContractSignPrompt from '../components/ContractSignPrompt.vue'
import MyContractsCard from '../components/MyContractsCard.vue'

const signPrompt = ref(null)
const contractsCard = ref(null)
const onSignContract = (c) => signPrompt.value?.openFor(c)
</script>
