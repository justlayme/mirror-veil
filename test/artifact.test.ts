import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import vm from 'node:vm'
import { JSDOM } from 'jsdom'
import { describe, expect, it } from 'vitest'

// These tests run the *built artifact*, not the source module. Three separate
// bugs shipped a tool that rendered fine and did nothing when you pressed the
// button, and the module-level unit tests passed through every one of them:
//   1. an ES import survived inlining -> SyntaxError, whole script dead
//   2. a multi-line `export { ... }` block left `{ A, B, }` -> SyntaxError
//   3. a constant used by the receipt was never inlined -> ReferenceError
// Anything that can only fail during bundling has to be asserted here.

const artifactPath = resolve(process.cwd(), 'dist/MirrorVeil.html')
const html = () => readFileSync(artifactPath, 'utf8')
const inlinedScript = () => {
  const blocks = [...html().matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1])
  return blocks[blocks.length - 1]
}

describe('Mirror Veil built artifact', () => {
  it('carries no bare ES import or export, which would be a SyntaxError in a classic script', () => {
    const script = inlinedScript()
    expect(script).not.toMatch(/^\s*import[\s{]/m)
    expect(script).not.toMatch(/^\s*export[\s{]/m)
  })

  it('parses as a classic script', () => {
    expect(() => new vm.Script(inlinedScript())).not.toThrow()
  })

  it('inlines every constant the engine references', () => {
    const script = inlinedScript()
    for (const name of [
      'MIRROR_VEIL_DOWNLOAD_FILE',
      'MIRROR_VEIL_DOWNLOAD_VERSION',
      'MIRROR_VEIL_NAME',
      'MIRROR_VEIL_OUTPUT_LABEL',
      'MIRROR_VEIL_TAGLINE',
    ]) {
      expect(script, `${name} must be defined, not just referenced`).toMatch(
        new RegExp(`const ${name}\\s*=`)
      )
    }
  })

  it('actually produces a cleaned CSV and a receipt when the form is submitted', async () => {
    const dom = new JSDOM(html(), { runScripts: 'dangerously', url: 'file:///MirrorVeil.html' })
    const { window } = dom
    const doc = window.document
    window.URL.createObjectURL = () => 'blob:stub'
    window.URL.revokeObjectURL = () => {}

    await new Promise((r) => setTimeout(r, 200))

    const form = doc.querySelector('#mv-form') as HTMLFormElement
    const paste = doc.querySelector('#mv-paste') as HTMLTextAreaElement
    expect(form).toBeTruthy()

    paste.value = [
      'timestamp,sender,message',
      '2026-03-24T09:00:00Z,Mike <555-123-4567>,call me at 555-123-4567 or mike@example.com',
      '2026-03-24T09:05:00Z,Sarah,mikey did you tell jen?',
      '',
    ].join('\n')

    form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }))
    await new Promise((r) => setTimeout(r, 900))

    const status = doc.querySelector('#mv-status')?.textContent || ''
    expect(status).toMatch(/Ready\./)
    expect(status).not.toMatch(/not defined|could not process/i)

    expect(doc.querySelectorAll('.mv-preview-table tbody tr').length).toBeGreaterThan(0)
    expect((doc.querySelector('#mv-download') as HTMLAnchorElement)?.hidden).toBe(false)

    const receipt = doc.querySelector('#mv-receipt')
    expect((receipt as HTMLElement)?.hidden).toBe(false)
    expect((receipt?.textContent || '').match(/[0-9a-f]{64}/g) || []).toHaveLength(2)
  })

  it('renders the removed/kept contract into the page', async () => {
    const dom = new JSDOM(html(), { runScripts: 'dangerously', url: 'file:///MirrorVeil.html' })
    await new Promise((r) => setTimeout(r, 200))
    const contract = dom.window.document.querySelector('#mv-contract')?.textContent || ''
    expect(contract).toContain('What it removes')
    expect(contract).toContain('What it keeps')
  })
})
