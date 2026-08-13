/// <reference types="vite/client" />
import type { AppInfo, ApiTestResult, InterviewSettings, MicStatus } from '../../shared/types'

declare global {
  interface Window {
    api: {
      getSettings(): Promise<InterviewSettings>
      saveSettings(partial: Partial<InterviewSettings>): Promise<InterviewSettings>
      testApiKey(keyOverride?: string): Promise<ApiTestResult>
      getMicStatus(): Promise<MicStatus>
      requestMic(): Promise<MicStatus>
      getAppInfo(): Promise<AppInfo>
    }
  }
}

export {}
