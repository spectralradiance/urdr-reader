import base from '@norn-apps/config/vitest'
import { defineConfig, mergeConfig } from 'vitest/config'

export default mergeConfig(base, defineConfig({}))
