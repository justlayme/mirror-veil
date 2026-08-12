import { describe, expect, it } from 'vitest'
import { sha256Hex, sha256HexSync } from '../src/mirrorVeilSha256.mjs'

// Known-answer tests from the NIST SHA-256 examples. These are the proof the
// implementation is correct — if they fail, the implementation is wrong.
const EMPTY = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
const ABC = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
const LONG = '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1'

describe('mirror veil sha256', () => {
  it('matches known digests synchronously without WebCrypto', () => {
    expect(sha256HexSync('')).toBe(EMPTY)
    expect(sha256HexSync('abc')).toBe(ABC)
    expect(sha256HexSync('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq')).toBe(LONG)
  })

  it('matches known digests through the async entry point', async () => {
    await expect(sha256Hex('abc')).resolves.toBe(ABC)
  })

  it('produces the same digest with and without WebCrypto', async () => {
    const sample = 'timestamp,sender,message\n2026-01-01T00:00:00Z,Person A,hello\n'
    await expect(sha256Hex(sample)).resolves.toBe(sha256HexSync(sample))
  })

  it('handles multibyte characters and content longer than one block', async () => {
    const sample = `${'unicode ✓ émoji 🎯 '.repeat(40)}tail`
    await expect(sha256Hex(sample)).resolves.toBe(sha256HexSync(sample))
    expect(sha256HexSync(sample)).toMatch(/^[0-9a-f]{64}$/)
  })
})
