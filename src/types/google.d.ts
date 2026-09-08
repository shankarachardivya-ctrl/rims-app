/**
 * Minimal ambient declarations for the Google browser SDKs we load at runtime.
 * Only the surface this app actually touches is declared.
 */

export {}

declare global {
  // ── Google Identity Services: OAuth 2.0 token flow ────────────────────────
  namespace google.accounts.oauth2 {
    interface TokenResponse {
      access_token: string
      expires_in: number
      scope: string
      token_type: string
      error?: string
      error_description?: string
    }

    interface TokenClientConfig {
      client_id: string
      scope: string
      callback: (response: TokenResponse) => void
      error_callback?: (error: { type: string; message?: string }) => void
      prompt?: '' | 'none' | 'consent' | 'select_account'
      hint?: string
    }

    interface TokenClient {
      requestAccessToken: (overrides?: {
        prompt?: '' | 'none' | 'consent' | 'select_account'
        hint?: string
      }) => void
    }

    function initTokenClient(config: TokenClientConfig): TokenClient
    function revoke(accessToken: string, done?: () => void): void
    function hasGrantedAllScopes(
      token: TokenResponse,
      ...scopes: string[]
    ): boolean
  }

  // ── Google Picker ─────────────────────────────────────────────────────────
  namespace google.picker {
    enum ViewId { SPREADSHEETS = 'spreadsheets', DOCS = 'docs' }
    enum Action { PICKED = 'picked', CANCEL = 'cancel', LOADED = 'loaded' }
    enum Feature {
      SUPPORT_DRIVES = 'sdr',
      MULTISELECT_ENABLED = 'multiselectEnabled',
      NAV_HIDDEN = 'navHidden',
    }
    enum Response { ACTION = 'action', DOCUMENTS = 'docs' }
    enum Document { ID = 'id', NAME = 'name', URL = 'url', MIME_TYPE = 'mimeType' }

    interface PickerDocument {
      id: string
      name?: string
      url?: string
      mimeType?: string
    }

    interface PickerResponse {
      action: string
      docs?: PickerDocument[]
    }

    class DocsView {
      constructor(viewId?: ViewId)
      setIncludeFolders(v: boolean): DocsView
      setSelectFolderEnabled(v: boolean): DocsView
      setMimeTypes(mimeTypes: string): DocsView
      setOwnedByMe(v: boolean): DocsView
    }

    class Picker {
      setVisible(visible: boolean): void
      dispose(): void
    }

    class PickerBuilder {
      addView(view: DocsView | ViewId): PickerBuilder
      setOAuthToken(token: string): PickerBuilder
      setDeveloperKey(key: string): PickerBuilder
      setAppId(appId: string): PickerBuilder
      setTitle(title: string): PickerBuilder
      setCallback(cb: (data: PickerResponse) => void): PickerBuilder
      enableFeature(feature: Feature): PickerBuilder
      disableFeature(feature: Feature): PickerBuilder
      build(): Picker
    }
  }

  // ── gapi loader (only used to pull in the picker module) ───────────────────
  const gapi: {
    load: (module: string, callback: () => void) => void
  }

  interface Window {
    google?: typeof google
    gapi?: typeof gapi
  }
}
