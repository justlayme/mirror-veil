import { describe, expect, it } from 'vitest'
import {
  MIRROR_VEIL_CSV_HEADERS,
  runMirrorVeil,
} from '../src/mirrorVeilStandalone.mjs'

describe('Mirror Veil standalone pipeline', () => {
  it('redacts common PII while preserving timestamps and stable pseudonyms', () => {
    const input = `timestamp,sender,message\n2026-03-24T09:00:00Z,Alice,Hey Bob call me at 555-123-4567 or email alice@example.com\n2026-03-24T09:05:00Z,Bob,Meet me at 123 Main St and bring card 4111 1111 1111 1111\n`

    const result = runMirrorVeil(input, {
      fileName: 'thread.csv',
      options: {
        enabled: true,
        redactNames: true,
        redactPhones: true,
        redactEmails: true,
        redactAddresses: true,
        redactCreditCards: true,
      },
    })

    expect(result.rows).toHaveLength(2)
    expect(result.rows[0]).toMatchObject({
      timestamp: '2026-03-24T09:00:00.000Z',
      sender: 'Person A',
    })
    expect(result.rows[0].message).toContain('Person B')
    expect(result.rows[0].message).toContain('[PHONE]')
    expect(result.rows[0].message).toContain('[EMAIL]')
    expect(result.rows[1]).toMatchObject({
      timestamp: '2026-03-24T09:05:00.000Z',
      sender: 'Person B',
    })
    expect(result.rows[1].message).toContain('[ADDRESS]')
    expect(result.rows[1].message).toContain('[CARD]')
    expect(result.csv.split('\n')[0]).toBe(MIRROR_VEIL_CSV_HEADERS.join(','))
  })

  it('keeps names untouched when redaction is optional and disabled', () => {
    const input = '[3/24/2026, 9:00 AM] Alice: Hey Bob\n[3/24/2026, 9:05 AM] Bob: Sure call me at 555-123-4567\n'

    const result = runMirrorVeil(input, {
      fileName: 'thread.txt',
      options: {
        enabled: false,
      },
    })

    expect(result.rows).toHaveLength(2)
    expect(result.rows[0].sender).toBe('Alice')
    expect(result.rows[0].message).toBe('Hey Bob')
    expect(result.rows[1].message).toContain('555-123-4567')
    expect(result.stats.redactionsApplied).toBe(0)
  })

  it('supports custom name dictionaries for message-body anonymization', () => {
    const input = `timestamp,sender,message\n2026-03-24T09:00:00Z,Alice,Charlie said Dana should see the screenshots\n`

    const result = runMirrorVeil(input, {
      fileName: 'thread.csv',
      options: {
        enabled: true,
        redactNames: true,
        customNames: ['Charlie', 'Dana'],
      },
    })

    expect(result.rows[0].message).toContain('Person B')
    expect(result.rows[0].message).toContain('Person C')
  })

  it('redacts street addresses at end of message and before punctuation', () => {
    const input = [
      'timestamp,sender,message',
      '2026-03-24T09:00:00Z,Alice,"Meet me at 123 Main St."',
      '2026-03-24T09:05:00Z,Bob,"Use the side door at 44 Oak Avenue"'
    ].join('\n')

    const result = runMirrorVeil(input, {
      fileName: 'thread.csv',
      options: {
        enabled: true,
        redactNames: false,
        redactAddresses: true,
      },
    })

    expect(result.rows[0].message).toContain('[ADDRESS].')
    expect(result.rows[1].message).toBe('Use the side door at [ADDRESS]')
  })

  it('parses semicolon-delimited CSV with camelCase headers and microsecond timestamps', () => {
    const input = [
      'senderName;messageBody;timestampUs',
      'Alex;Can we reset?;1767261600000000',
      'Jamie;Yes, I want that too.;1767261720000000'
    ].join('\n')

    const result = runMirrorVeil(input, {
      fileName: 'thread.csv',
      options: {
        enabled: false,
      },
    })

    expect(result.rows).toHaveLength(2)
    expect(result.rows[0]).toMatchObject({
      sender: 'Alex',
      message: 'Can we reset?',
      timestamp: '2026-01-01T10:00:00.000Z',
    })
    expect(result.rows[1]).toMatchObject({
      sender: 'Jamie',
      message: 'Yes, I want that too.',
      timestamp: '2026-01-01T10:02:00.000Z',
    })
  })

  it('parses headerless CSV exports by inferring sender/message/timestamp columns', () => {
    const input = [
      'Alex,Can we reset this tonight?,1767261600000',
      'Jamie,Yes I want that too,1767261720000'
    ].join('\n')

    const result = runMirrorVeil(input, {
      fileName: 'thread.csv',
      options: { enabled: false },
    })

    expect(result.rows).toHaveLength(2)
    expect(result.rows[0]).toMatchObject({
      sender: 'Alex',
      message: 'Can we reset this tonight?',
      timestamp: '2026-01-01T10:00:00.000Z',
    })
    expect(result.rows[1]).toMatchObject({
      sender: 'Jamie',
      message: 'Yes I want that too',
      timestamp: '2026-01-01T10:02:00.000Z',
    })
  })

  it('prefers the correct delimiter for headerless rows when message text contains commas', () => {
    const input = [
      '1767261600000|+15555550100|Need clarity tonight',
      '1767261720000|+15555550199|Yes, absolutely'
    ].join('\n')

    const result = runMirrorVeil(input, {
      fileName: 'thread.txt',
      options: { enabled: false },
    })

    expect(result.rows).toHaveLength(2)
    expect(result.rows[0]).toMatchObject({
      sender: '+15555550100',
      message: 'Need clarity tonight',
      timestamp: '2026-01-01T10:00:00.000Z',
    })
    expect(result.rows[1]).toMatchObject({
      sender: '+15555550199',
      message: 'Yes, absolutely',
      timestamp: '2026-01-01T10:02:00.000Z',
    })
  })

  it('uses flat sender email and phone fields when display names are absent', () => {
    const csv = [
      'senderEmail,messageBody,timestampMs',
      'alex@example.com,Can we reset?,1767261600000',
      '+1 (555) 555-0199,Yes lets do that.,1767261720000'
    ].join('\n')
    const json = JSON.stringify({
      messages: [
        { fromEmail: 'alex@example.com', messageBody: 'Can we reset?', timestampMs: 1767261600000 },
        { senderPhone: '+1 (555) 555-0199', messageBody: 'Yes lets do that.', timestampMs: 1767261720000 },
      ],
    })

    const csvResult = runMirrorVeil(csv, {
      fileName: 'thread.csv',
      options: { enabled: false },
    })
    const jsonResult = runMirrorVeil(json, {
      fileName: 'thread.json',
      options: { enabled: false },
    })

    expect(csvResult.rows.map((row) => row.sender)).toEqual(['alex@example.com', '+1 (555) 555-0199'])
    expect(jsonResult.rows.map((row) => row.sender)).toEqual(['alex@example.com', '+1 (555) 555-0199'])
  })

  it('strips transport suffix metadata from sender labels across export formats', () => {
    const input = JSON.stringify({
      messages: [
        { senderName: 'from: "Alex" <alex@example.com> sent as iMessage', messageBody: 'Checking in.', timestampMs: 1767261600000 },
        { senderName: 'to Jamie (+1 (555) 555-0199) through sms', messageBody: 'All good here.', timestampMs: 1767261720000 },
      ]
    })

    const result = runMirrorVeil(input, {
      fileName: 'thread.json',
      options: { enabled: false },
    })

    expect(result.rows).toHaveLength(2)
    expect(result.rows[0]).toMatchObject({
      sender: 'Alex',
      message: 'Checking in.',
    })
    expect(result.rows[1]).toMatchObject({
      sender: 'Jamie',
      message: 'All good here.',
    })
  })

  it('normalizes placeholder sender labels to Unknown so they do not become fake participants', () => {
    const input = [
      'timestamp,sender,message',
      '2026-03-24T09:00:00Z,N/A,Hey Riley',
      '2026-03-24T09:05:00Z,Riley,Got it'
    ].join('\n')

    const result = runMirrorVeil(input, {
      fileName: 'thread.csv',
      options: {
        enabled: true,
        redactNames: true,
      },
    })

    expect(result.rows).toHaveLength(2)
    expect(result.rows[0]).toMatchObject({
      sender: 'Unknown',
    })
    expect(result.rows[1]).toMatchObject({
      sender: 'Person A',
    })
    expect(result.rows[0].message).toContain('Person A')
  })

  it('keeps culturally valid short names that resemble placeholders', () => {
    const input = [
      'timestamp,sender,message',
      '2026-03-24T09:00:00Z,Nil,Hey Owner',
      '2026-03-24T09:05:00Z,Owner,Got it'
    ].join('\n')

    const result = runMirrorVeil(input, {
      fileName: 'thread.csv',
      options: {
        enabled: true,
        redactNames: true,
      },
    })

    expect(result.rows).toHaveLength(2)
    expect(result.rows[0].sender).toBe('Person A')
    expect(result.rows[1].sender).toBe('Person B')
    expect(result.rows[0].message).toContain('Person B')
    expect(Object.keys(result.nameMap)).toEqual(expect.arrayContaining(['nil', 'owner']))
  })

  it('bounds oversized composite sender labels without losing display names near the front', () => {
    const longSuffix = 'x'.repeat(1600)
    const input = JSON.stringify({
      messages: [
        {
          senderName: `"Alex" <alex@example.com> ${longSuffix}`,
          messageBody: 'Checking in.',
          timestampMs: 1767261600000,
        },
      ],
    })

    const result = runMirrorVeil(input, {
      fileName: 'thread.json',
      options: { enabled: false },
    })

    expect(result.rows).toHaveLength(1)
    expect(result.rows[0].sender).toBe('Alex')
  })

  it('parses JSON payloads with data arrays and camelCase fields', () => {
    const input = JSON.stringify({
      data: [
        { senderName: 'Alex', messageBody: 'Can we reset?', timestampUs: 1767261600000000 },
        { senderName: 'Jamie', messageBody: 'Yes, I want that too.', timestampUs: 1767261720000000 }
      ]
    })

    const result = runMirrorVeil(input, {
      fileName: 'thread.json',
      options: {
        enabled: false,
      },
    })

    expect(result.rows).toHaveLength(2)
    expect(result.rows[0].sender).toBe('Alex')
    expect(result.rows[1].sender).toBe('Jamie')
    expect(result.rows.every((row) => row.timestamp.endsWith('Z'))).toBe(true)
  })

  it('parses JSON payloads that use message_list arrays', () => {
    const input = JSON.stringify({
      message_list: [
        { senderName: 'Alex', messageBody: 'Can we reset?', timestampMs: 1767261600000 },
        { senderName: 'Jamie', messageBody: 'Yes.', timestampMs: 1767261720000 },
      ],
    })

    const result = runMirrorVeil(input, {
      fileName: 'thread.json',
      options: { enabled: false },
    })

    expect(result.rows).toHaveLength(2)
    expect(result.rows.map((row) => row.sender)).toEqual(['Alex', 'Jamie'])
    expect(result.rows.map((row) => row.message)).toEqual(['Can we reset?', 'Yes.'])
  })

  it('parses nested payload.chat_messages arrays', () => {
    const input = JSON.stringify({
      payload: {
        chat_messages: [
          { fromName: 'Alex', text: 'Need anything?', sentAt: '2026-01-01T10:00:00Z' },
          { fromName: 'Jamie', text: 'All good here.', sentAt: '2026-01-01T10:01:00Z' },
        ],
      },
    })

    const result = runMirrorVeil(input, {
      fileName: 'thread.json',
      options: { enabled: false },
    })

    expect(result.rows).toHaveLength(2)
    expect(result.rows[0]).toMatchObject({ sender: 'Alex', message: 'Need anything?' })
    expect(result.rows[1]).toMatchObject({ sender: 'Jamie', message: 'All good here.' })
  })

  it('parses nested JSON exports with conversation.messages payloads', () => {
    const input = JSON.stringify({
      conversation: {
        messages: [
          { fromDisplayName: 'Alex', bodyText: 'Can we reset?', timestampMs: 1767261600000 },
          { fromDisplayName: 'Jamie', bodyText: 'Yes, I want that too.', timestampMs: 1767261720000 }
        ]
      }
    })

    const result = runMirrorVeil(input, {
      fileName: 'thread.json',
      options: { enabled: false },
    })

    expect(result.rows).toHaveLength(2)
    expect(result.rows[0]).toMatchObject({
      sender: 'Alex',
      message: 'Can we reset?',
      timestamp: '2026-01-01T10:00:00.000Z',
    })
    expect(result.rows[1]).toMatchObject({
      sender: 'Jamie',
      message: 'Yes, I want that too.',
      timestamp: '2026-01-01T10:02:00.000Z',
    })
  })

  it('parses exports where payload is a stringified JSON object', () => {
    const input = JSON.stringify({
      payload: JSON.stringify({
        rows: [
          { sender_name: 'Alex', message_text: 'Checking in.', ts: 1767261600 },
          { sender_name: 'Jamie', message_text: 'All good here.', ts: 1767261720 }
        ]
      })
    })

    const result = runMirrorVeil(input, {
      fileName: 'thread.json',
      options: { enabled: false },
    })

    expect(result.rows).toHaveLength(2)
    expect(result.rows[0]).toMatchObject({
      sender: 'Alex',
      message: 'Checking in.',
      timestamp: '2026-01-01T10:00:00.000Z',
    })
    expect(result.rows[1]).toMatchObject({
      sender: 'Jamie',
      message: 'All good here.',
      timestamp: '2026-01-01T10:02:00.000Z',
    })
  })

  it('parses exports where payload contains NDJSON text rows', () => {
    const input = JSON.stringify({
      payload: [
        '{"sender":"Alex","message":"Can we reset?","timestamp_ms":1767261600000}',
        '{"sender":"Jamie","message":"Yes, I want that too.","timestamp_ms":1767261720000}'
      ].join('\n')
    })

    const result = runMirrorVeil(input, {
      fileName: 'thread.json',
      options: { enabled: false },
    })

    expect(result.rows).toHaveLength(2)
    expect(result.rows[0]).toMatchObject({
      sender: 'Alex',
      message: 'Can we reset?',
      timestamp: '2026-01-01T10:00:00.000Z',
    })
    expect(result.rows[1]).toMatchObject({
      sender: 'Jamie',
      message: 'Yes, I want that too.',
      timestamp: '2026-01-01T10:02:00.000Z',
    })
  })

  it('parses markdown-fenced JSON payloads', () => {
    const input = [
      '```json',
      JSON.stringify({
        messages: [
          { sender: 'Alex', message: 'Can we reset?', timestamp_ms: 1767261600000 },
          { sender: 'Jamie', message: 'Yes, I want that too.', timestamp_ms: 1767261720000 }
        ]
      }),
      '```'
    ].join('\n')

    const result = runMirrorVeil(input, {
      fileName: 'thread.json',
      options: { enabled: false },
    })

    expect(result.rows).toHaveLength(2)
    expect(result.rows[0]).toMatchObject({
      sender: 'Alex',
      message: 'Can we reset?',
      timestamp: '2026-01-01T10:00:00.000Z',
    })
    expect(result.rows[1]).toMatchObject({
      sender: 'Jamie',
      message: 'Yes, I want that too.',
      timestamp: '2026-01-01T10:02:00.000Z',
    })
  })

  it('parses markdown-fenced JSON payloads with comments and trailing commas', () => {
    const input = [
      '```json',
      '{',
      '  // chat export v2',
      '  "messages": [',
      '    {"sender":"Alex","message":"Can we reset?","timestamp_ms":1767261600000,},',
      '    {"sender":"Jamie","message":"Yes, I want that too.","timestamp_ms":1767261720000,},',
      '  ],',
      '}',
      '```'
    ].join('\n')

    const result = runMirrorVeil(input, {
      fileName: 'thread.json',
      options: { enabled: false },
    })

    expect(result.rows).toHaveLength(2)
    expect(result.rows[0]).toMatchObject({
      sender: 'Alex',
      message: 'Can we reset?',
      timestamp: '2026-01-01T10:00:00.000Z',
    })
    expect(result.rows[1]).toMatchObject({
      sender: 'Jamie',
      message: 'Yes, I want that too.',
      timestamp: '2026-01-01T10:02:00.000Z',
    })
  })

  it('parses object-map message containers under messages key', () => {
    const input = JSON.stringify({
      messages: {
        'm-1': { sender: 'Alex', message: 'Can we reset?', timestamp_ms: 1767261600000 },
        'm-2': { sender: 'Jamie', message: 'Yes, I want that too.', timestamp_ms: 1767261720000 }
      }
    })

    const result = runMirrorVeil(input, {
      fileName: 'thread.json',
      options: { enabled: false },
    })

    expect(result.rows).toHaveLength(2)
    expect(result.rows[0]).toMatchObject({
      sender: 'Alex',
      message: 'Can we reset?',
      timestamp: '2026-01-01T10:00:00.000Z',
    })
    expect(result.rows[1]).toMatchObject({
      sender: 'Jamie',
      message: 'Yes, I want that too.',
      timestamp: '2026-01-01T10:02:00.000Z',
    })
  })

  it('parses object-map message containers that include metadata keys', () => {
    const input = JSON.stringify({
      messages: {
        metadata: { exporter: 'sms-backup', version: 3 },
        'm-1': { sender: 'Alex', message: 'Can we reset?', timestamp_ms: 1767261600000 },
        'm-2': { sender: 'Jamie', message: 'Yes, I want that too.', timestamp_ms: 1767261720000 }
      }
    })

    const result = runMirrorVeil(input, {
      fileName: 'thread.json',
      options: { enabled: false },
    })

    expect(result.rows).toHaveLength(2)
    expect(result.rows[0]).toMatchObject({
      sender: 'Alex',
      message: 'Can we reset?',
      timestamp: '2026-01-01T10:00:00.000Z',
    })
    expect(result.rows[1]).toMatchObject({
      sender: 'Jamie',
      message: 'Yes, I want that too.',
      timestamp: '2026-01-01T10:02:00.000Z',
    })
  })

  it('parses single object-map message rows with metadata when strong signals are present', () => {
    const input = JSON.stringify({
      messages: {
        metadata: { exporter: 'sms-backup', version: 3 },
        'm-1': { sender: 'Alex', message: 'Can we reset?', timestamp_ms: 1767261600000, direction: 'outgoing' }
      }
    })

    const result = runMirrorVeil(input, {
      fileName: 'thread.json',
      options: { enabled: false },
    })

    expect(result.rows).toHaveLength(1)
    expect(result.rows[0]).toMatchObject({
      sender: 'Alex',
      message: 'Can we reset?',
      timestamp: '2026-01-01T10:00:00.000Z',
    })
  })

  it('parses mixed-case JSON container keys and message fields', () => {
    const input = JSON.stringify({
      Conversation: {
        Messages: {
          'm-1': { Sender: 'Alex', Message: 'Can we reset?', TimestampMs: 1767261600000 },
          'm-2': { Sender: 'Jamie', Message: 'Yes, I want that too.', TimestampMs: 1767261720000 },
        },
      },
    })

    const result = runMirrorVeil(input, {
      fileName: 'thread.json',
      options: { enabled: false },
    })

    expect(result.rows).toHaveLength(2)
    expect(result.rows[0]).toMatchObject({
      sender: 'Alex',
      message: 'Can we reset?',
      timestamp: '2026-01-01T10:00:00.000Z',
    })
    expect(result.rows[1]).toMatchObject({
      sender: 'Jamie',
      message: 'Yes, I want that too.',
      timestamp: '2026-01-01T10:02:00.000Z',
    })
  })

  it('parses NDJSON exports and skips malformed lines', () => {
    const input = [
      '{"sender":"Alex","message":"Can we reset?","timestamp_ms":1767261600000}',
      '{"sender":"Jamie","message":"Yes, I want that too.",',
      '{"sender":"Jamie","message":"Lets talk tonight.","timestamp_ms":1767261720000}'
    ].join('\n')

    const result = runMirrorVeil(input, {
      fileName: 'thread.jsonl',
      options: { enabled: false },
    })

    expect(result.rows).toHaveLength(2)
    expect(result.rows[0]).toMatchObject({
      sender: 'Alex',
      message: 'Can we reset?',
      timestamp: '2026-01-01T10:00:00.000Z',
    })
    expect(result.rows[1]).toMatchObject({
      sender: 'Jamie',
      message: 'Lets talk tonight.',
      timestamp: '2026-01-01T10:02:00.000Z',
    })
  })

  it('parses NDJSON exports where each line is a quoted JSON object string', () => {
    const input = [
      '"{\\"sender\\":\\"Alex\\",\\"message\\":\\"Can we reset?\\",\\"timestamp_ms\\":1767261600000}"',
      '"{\\"sender\\":\\"Jamie\\",\\"message\\":\\"Yes, I want that too.\\",\\"timestamp_ms\\":1767261720000}"',
    ].join('\n')

    const result = runMirrorVeil(input, {
      fileName: 'thread.jsonl',
      options: { enabled: false },
    })

    expect(result.rows).toHaveLength(2)
    expect(result.rows[0]).toMatchObject({
      sender: 'Alex',
      message: 'Can we reset?',
      timestamp: '2026-01-01T10:00:00.000Z',
    })
    expect(result.rows[1]).toMatchObject({
      sender: 'Jamie',
      message: 'Yes, I want that too.',
      timestamp: '2026-01-01T10:02:00.000Z',
    })
  })

  it('parses single-line NDJSON exports', () => {
    const input = '{"sender":"Alex","message":"Single entry works.","timestamp_ms":1767261600000}'

    const result = runMirrorVeil(input, {
      fileName: 'thread.jsonl',
      options: { enabled: false },
    })

    expect(result.rows).toHaveLength(1)
    expect(result.rows[0]).toMatchObject({
      sender: 'Alex',
      message: 'Single entry works.',
      timestamp: '2026-01-01T10:00:00.000Z',
    })
  })

  it('parses exports where data is a stringified JSON array', () => {
    const input = JSON.stringify({
      data: JSON.stringify([
        { fromName: 'Alex', body: 'Checking in.', timestampMs: 1767261600000 },
        { fromName: 'Jamie', body: 'All good here.', timestampMs: 1767261720000 }
      ])
    })

    const result = runMirrorVeil(input, {
      fileName: 'thread.json',
      options: { enabled: false },
    })

    expect(result.rows).toHaveLength(2)
    expect(result.rows[0]).toMatchObject({
      sender: 'Alex',
      message: 'Checking in.',
      timestamp: '2026-01-01T10:00:00.000Z',
    })
    expect(result.rows[1]).toMatchObject({
      sender: 'Jamie',
      message: 'All good here.',
      timestamp: '2026-01-01T10:02:00.000Z',
    })
  })

  it('parses JSON rows with nested sender and message objects', () => {
    const input = JSON.stringify({
      messages: [
        {
          sender: { displayName: 'Alex', id: 'u-1' },
          message: { text: 'Can we reset?', metadata: { source: 'ios' } },
          timestampMs: 1767261600000,
        },
        {
          sender: { name: 'Jamie', email: 'jamie@example.com' },
          messageBody: { content: 'Yes, I want that too.' },
          timestampMs: 1767261720000,
        }
      ]
    })

    const result = runMirrorVeil(input, {
      fileName: 'thread.json',
      options: { enabled: false },
    })

    expect(result.rows).toHaveLength(2)
    expect(result.rows[0]).toMatchObject({
      sender: 'Alex',
      message: 'Can we reset?',
      timestamp: '2026-01-01T10:00:00.000Z',
    })
    expect(result.rows[1]).toMatchObject({
      sender: 'Jamie',
      message: 'Yes, I want that too.',
      timestamp: '2026-01-01T10:02:00.000Z',
    })
    expect(result.rows.some((row) => row.message.includes('[object Object]'))).toBe(false)
  })

  it('composes full sender names when nested exports split first/last and given/family fields', () => {
    const input = JSON.stringify({
      messages: [
        {
          sender: { first_name: 'Alex', last_name: 'Stone', id: 'u-1' },
          message: { text: 'Can we reset?', metadata: { source: 'ios' } },
          timestampMs: 1767261600000,
        },
        {
          sender: { givenName: 'Jamie', familyName: 'Cole', email: 'jamie@example.com' },
          messageBody: { content: 'Yes, I want that too.' },
          timestampMs: 1767261720000,
        }
      ]
    })

    const result = runMirrorVeil(input, {
      fileName: 'thread.json',
      options: { enabled: false },
    })

    expect(result.rows).toHaveLength(2)
    expect(result.rows[0]).toMatchObject({
      sender: 'Alex Stone',
      message: 'Can we reset?',
      timestamp: '2026-01-01T10:00:00.000Z',
    })
    expect(result.rows[1]).toMatchObject({
      sender: 'Jamie Cole',
      message: 'Yes, I want that too.',
      timestamp: '2026-01-01T10:02:00.000Z',
    })
  })

  it('normalizes sender prefixes and zero-width characters from text exports', () => {
    const input = [
      '[3/24/2026, 9:00 AM] from:\u200B Layne: Can we reset?',
      '[3/24/2026, 9:05 AM] to Riley: Yes, I want that too.'
    ].join('\n')

    const result = runMirrorVeil(input, {
      fileName: 'thread.txt',
      options: { enabled: false },
    })

    expect(result.rows).toHaveLength(2)
    expect(result.rows[0]).toMatchObject({
      sender: 'Layne',
      message: 'Can we reset?'
    })
    expect(result.rows[1]).toMatchObject({
      sender: 'Riley',
      message: 'Yes, I want that too.'
    })
  })

  it('normalizes accented localized sender prefixes from text exports', () => {
    const input = [
      '[3/24/2026, 9:00 AM] à Riley: On peut reparler calmement?',
      '[3/24/2026, 9:05 AM] de Layne: Oui, je suis d’accord.'
    ].join('\n')

    const result = runMirrorVeil(input, {
      fileName: 'thread.txt',
      options: { enabled: false },
    })

    expect(result.rows).toHaveLength(2)
    expect(result.rows[0]).toMatchObject({
      sender: 'Riley',
      message: 'On peut reparler calmement?'
    })
    expect(result.rows[1]).toMatchObject({
      sender: 'Layne',
      message: 'Oui, je suis d’accord.'
    })
  })

  it('normalizes sender prefixes with equals separators from text exports', () => {
    const input = [
      '[3/24/2026, 9:00 AM] from= Layne: Can we reset?',
      '[3/24/2026, 9:05 AM] to=Riley: Yes, I want that too.'
    ].join('\n')

    const result = runMirrorVeil(input, {
      fileName: 'thread.txt',
      options: { enabled: false },
    })

    expect(result.rows).toHaveLength(2)
    expect(result.rows[0]).toMatchObject({
      sender: 'Layne',
      message: 'Can we reset?'
    })
    expect(result.rows[1]).toMatchObject({
      sender: 'Riley',
      message: 'Yes, I want that too.'
    })
  })

  it('normalizes sender prefixes with extended unicode arrows and slash separators from text exports', () => {
    const input = [
      '[3/24/2026, 9:00 AM] from/Layne: Can we reset?',
      '[3/24/2026, 9:05 AM] to⟹Riley: Yes, I want that too.'
    ].join('\n')

    const result = runMirrorVeil(input, {
      fileName: 'thread.txt',
      options: { enabled: false },
    })

    expect(result.rows).toHaveLength(2)
    expect(result.rows[0]).toMatchObject({
      sender: 'Layne',
      message: 'Can we reset?'
    })
    expect(result.rows[1]).toMatchObject({
      sender: 'Riley',
      message: 'Yes, I want that too.'
    })
  })

  it('parses directional sender-only labels when nested sender uses arrows or equals', () => {
    const input = [
      '[3/24/2026, 9:00 AM] from: Riley -> Can we reset?',
      '[3/24/2026, 9:05 AM] to: Layne = Yes, I want that too.'
    ].join('\n')

    const result = runMirrorVeil(input, {
      fileName: 'thread.txt',
      options: { enabled: false },
    })

    expect(result.rows).toHaveLength(2)
    expect(result.rows[0]).toMatchObject({
      sender: 'Riley',
      message: 'Can we reset?'
    })
    expect(result.rows[1]).toMatchObject({
      sender: 'Layne',
      message: 'Yes, I want that too.'
    })
  })

  it('normalizes localized sender prefixes when punctuation separators are missing', () => {
    const input = [
      '[3/24/2026, 9:00 AM] de Layne: Can we reset?',
      '[3/24/2026, 9:05 AM] para Riley: Yes, I want that too.'
    ].join('\n')

    const result = runMirrorVeil(input, {
      fileName: 'thread.txt',
      options: { enabled: false },
    })

    expect(result.rows).toHaveLength(2)
    expect(result.rows[0]).toMatchObject({
      sender: 'Layne',
      message: 'Can we reset?'
    })
    expect(result.rows[1]).toMatchObject({
      sender: 'Riley',
      message: 'Yes, I want that too.'
    })
  })

  it('does not strip real sender names that start with non-allowlisted prefix-like words', () => {
    const input = [
      '[3/24/2026, 9:00 AM] An Marie: Can we reset?',
      '[3/24/2026, 9:05 AM] Do Riley: Yes, I want that too.'
    ].join('\n')

    const result = runMirrorVeil(input, {
      fileName: 'thread.txt',
      options: { enabled: false },
    })

    expect(result.rows).toHaveLength(2)
    expect(result.rows[0]).toMatchObject({
      sender: 'An Marie',
      message: 'Can we reset?'
    })
    expect(result.rows[1]).toMatchObject({
      sender: 'Do Riley',
      message: 'Yes, I want that too.'
    })
  })

  it('normalizes nordic and slavic sender prefixes when punctuation separators are missing', () => {
    const input = [
      '[3/24/2026, 9:00 AM] fra Layne: Can we reset?',
      '[3/24/2026, 9:05 AM] til Riley: Yes, I want that too.',
      '[3/24/2026, 9:10 AM] od Layne: Thank you for saying that.',
      '[3/24/2026, 9:15 AM] do: Riley: We can keep working on this.',
      '[3/24/2026, 9:20 AM] an: Riley: I can read explicit German recipient labels.'
    ].join('\n')

    const result = runMirrorVeil(input, {
      fileName: 'thread.txt',
      options: { enabled: false },
    })

    expect(result.rows).toHaveLength(5)
    expect(result.rows[0]).toMatchObject({
      sender: 'Layne',
      message: 'Can we reset?'
    })
    expect(result.rows[1]).toMatchObject({
      sender: 'Riley',
      message: 'Yes, I want that too.'
    })
    expect(result.rows[2]).toMatchObject({
      sender: 'Layne',
      message: 'Thank you for saying that.'
    })
    expect(result.rows[3]).toMatchObject({
      sender: 'Riley',
      message: 'We can keep working on this.'
    })
    expect(result.rows[4]).toMatchObject({
      sender: 'Riley',
      message: 'I can read explicit German recipient labels.'
    })
  })

  it('extracts display names from composite sender endpoint labels in text exports', () => {
    const input = [
      '[3/24/2026, 9:00 AM] from: "Layne" <layne@example.com>: Can we reset?',
      '[3/24/2026, 9:05 AM] to Riley (+1 (555) 555-0199): Yes, I want that too.'
    ].join('\n')

    const result = runMirrorVeil(input, {
      fileName: 'thread.txt',
      options: { enabled: false },
    })

    expect(result.rows).toHaveLength(2)
    expect(result.rows[0]).toMatchObject({
      sender: 'Layne',
      message: 'Can we reset?'
    })
    expect(result.rows[1]).toMatchObject({
      sender: 'Riley',
      message: 'Yes, I want that too.'
    })
  })

  it('extracts display names from square-bracket composite sender endpoint labels in text exports', () => {
    const input = [
      '[3/24/2026, 9:00 AM] from: Layne [layne@example.com]: Can we reset?',
      '[3/24/2026, 9:05 AM] to Riley [+1 (555) 555-0199]: Yes, I want that too.'
    ].join('\n')

    const result = runMirrorVeil(input, {
      fileName: 'thread.txt',
      options: { enabled: false },
    })

    expect(result.rows).toHaveLength(2)
    expect(result.rows[0]).toMatchObject({
      sender: 'Layne',
      message: 'Can we reset?'
    })
    expect(result.rows[1]).toMatchObject({
      sender: 'Riley',
      message: 'Yes, I want that too.'
    })
  })

  it('extracts display names from fullwidth-bracket composite sender endpoint labels in text exports', () => {
    const input = [
      '[3/24/2026, 9:00 AM] from: Layne 【layne@example.com】: Can we reset?',
      '[3/24/2026, 9:05 AM] to Riley ［+1 (555) 555-0199］: Yes, I want that too.'
    ].join('\n')

    const result = runMirrorVeil(input, {
      fileName: 'thread.txt',
      options: { enabled: false },
    })

    expect(result.rows).toHaveLength(2)
    expect(result.rows[0]).toMatchObject({
      sender: 'Layne',
      message: 'Can we reset?'
    })
    expect(result.rows[1]).toMatchObject({
      sender: 'Riley',
      message: 'Yes, I want that too.'
    })
  })

  it('extracts display names from fullwidth-parenthesis composite sender endpoint labels in text exports', () => {
    const input = [
      '[3/24/2026, 9:00 AM] from: Layne （layne@example.com）: Can we reset?',
      '[3/24/2026, 9:05 AM] to Riley （+1 (555) 555-0199）: Yes, I want that too.'
    ].join('\n')

    const result = runMirrorVeil(input, {
      fileName: 'thread.txt',
      options: { enabled: false },
    })

    expect(result.rows).toHaveLength(2)
    expect(result.rows[0]).toMatchObject({
      sender: 'Layne',
      message: 'Can we reset?'
    })
    expect(result.rows[1]).toMatchObject({
      sender: 'Riley',
      message: 'Yes, I want that too.'
    })
  })

  it('extracts display names from curly-brace composite sender endpoint labels in text exports', () => {
    const input = [
      '[3/24/2026, 9:00 AM] from: Layne {layne@example.com}: Can we reset?',
      '[3/24/2026, 9:05 AM] to Riley {+1 (555) 555-0199}: Yes, I want that too.'
    ].join('\n')

    const result = runMirrorVeil(input, {
      fileName: 'thread.txt',
      options: { enabled: false },
    })

    expect(result.rows).toHaveLength(2)
    expect(result.rows[0]).toMatchObject({
      sender: 'Layne',
      message: 'Can we reset?'
    })
    expect(result.rows[1]).toMatchObject({
      sender: 'Riley',
      message: 'Yes, I want that too.'
    })
  })

  it('extracts display names from loose curly-brace composite sender endpoint labels', () => {
    const input = JSON.stringify({
      messages: [
        {
          senderName: 'Layne {layne@example.com} exported copy',
          messageBody: 'Can we reset?',
          timestampMs: 1767261600000,
        },
        {
          senderName: 'Riley ｛+1 (555) 555-0199｝ archived copy',
          messageBody: 'Yes, lets do that.',
          timestampMs: 1767261720000,
        },
      ],
    })

    const result = runMirrorVeil(input, {
      fileName: 'thread.json',
      options: { enabled: false },
    })

    expect(result.rows).toHaveLength(2)
    expect(result.rows[0]).toMatchObject({
      sender: 'Layne',
      message: 'Can we reset?'
    })
    expect(result.rows[1]).toMatchObject({
      sender: 'Riley',
      message: 'Yes, lets do that.'
    })
  })

  it('extracts display names from composite sender endpoint labels when exports append trailing metadata', () => {
    const input = [
      '[3/24/2026, 9:00 AM] from: "Layne" <layne@example.com> - iMessage: Can we reset?',
      '[3/24/2026, 9:05 AM] to Riley (+1 (555) 555-0199) via sms: Yes, I want that too.'
    ].join('\n')

    const result = runMirrorVeil(input, {
      fileName: 'thread.txt',
      options: { enabled: false },
    })

    expect(result.rows).toHaveLength(2)
    expect(result.rows[0]).toMatchObject({
      sender: 'Layne',
      message: 'Can we reset?'
    })
    expect(result.rows[1]).toMatchObject({
      sender: 'Riley',
      message: 'Yes, I want that too.'
    })
  })

  it('parses bracketed dash-format lines and localized sender prefixes', () => {
    const input = [
      '[3/24/2026, 9:00 AM] de:\u200B Layne - Can we reset?',
      '[3/24/2026, 9:05 AM] para: Riley - Yes, lets do that.'
    ].join('\n')

    const result = runMirrorVeil(input, {
      fileName: 'thread.txt',
      options: { enabled: false },
    })

    expect(result.rows).toHaveLength(2)
    expect(result.rows[0]).toMatchObject({
      sender: 'Layne',
      message: 'Can we reset?'
    })
    expect(result.rows[1]).toMatchObject({
      sender: 'Riley',
      message: 'Yes, lets do that.'
    })
  })

  it('parses directional sender-only labels that wrap nested arrow-style sender/message rows', () => {
    const input = [
      '[3/24/2026, 9:00 AM] from: Layne -> Can we reset?',
      '[3/24/2026, 9:05 AM] to: Riley => Yes, lets do that.'
    ].join('\n')

    const result = runMirrorVeil(input, {
      fileName: 'thread.txt',
      options: { enabled: false },
    })

    expect(result.rows).toHaveLength(2)
    expect(result.rows[0]).toMatchObject({
      sender: 'Layne',
      message: 'Can we reset?'
    })
    expect(result.rows[1]).toMatchObject({
      sender: 'Riley',
      message: 'Yes, lets do that.'
    })
  })

  it('parses Telegram-style lines with sender-first timestamps', () => {
    const input = [
      'Layne, [24.03.2026 09:00:00]: Can we reset?',
      'Riley, [24.03.2026 09:05:00]: Yes, lets do that.'
    ].join('\n')

    const result = runMirrorVeil(input, {
      fileName: 'thread.txt',
      options: { enabled: false },
    })

    expect(result.rows).toHaveLength(2)
    expect(result.rows[0]).toMatchObject({
      sender: 'Layne',
      message: 'Can we reset?'
    })
    expect(result.rows[1]).toMatchObject({
      sender: 'Riley',
      message: 'Yes, lets do that.'
    })
  })

  it('parses timestamped lines that use dash between sender and message', () => {
    const input = [
      '3/24/2026, 9:00 AM - Layne - Can we reset?',
      '3/24/2026, 9:05 AM - Riley - Yes, lets do that.'
    ].join('\n')

    const result = runMirrorVeil(input, {
      fileName: 'thread.txt',
      options: { enabled: false },
    })

    expect(result.rows).toHaveLength(2)
    expect(result.rows[0]).toMatchObject({
      sender: 'Layne',
      message: 'Can we reset?'
    })
    expect(result.rows[1]).toMatchObject({
      sender: 'Riley',
      message: 'Yes, lets do that.'
    })
  })

  it('parses sender labels that use fullwidth colon', () => {
    const input = [
      'Layne： Can we reset?',
      'Riley： Yes, lets do that.'
    ].join('\n')

    const result = runMirrorVeil(input, {
      fileName: 'thread.txt',
      options: { enabled: false },
    })

    expect(result.rows).toHaveLength(2)
    expect(result.rows[0]).toMatchObject({
      sender: 'Layne',
      message: 'Can we reset?'
    })
    expect(result.rows[1]).toMatchObject({
      sender: 'Riley',
      message: 'Yes, lets do that.'
    })
  })

  it('parses pipe-delimited text exports with timestamp and sender columns', () => {
    const input = [
      '3/24/2026, 9:00 AM | Layne | Can we reset?',
      '3/24/2026, 9:05 AM | Riley | Yes, lets do that.'
    ].join('\n')

    const result = runMirrorVeil(input, {
      fileName: 'thread.txt',
      options: { enabled: false },
    })

    expect(result.rows).toHaveLength(2)
    expect(result.rows[0]).toMatchObject({
      sender: 'Layne',
      message: 'Can we reset?'
    })
    expect(result.rows[1]).toMatchObject({
      sender: 'Riley',
      message: 'Yes, lets do that.'
    })
  })

  it('parses JSON rows when sender/message fields are stringified JSON objects', () => {
    const input = JSON.stringify({
      messages: [
        {
          sender: '{"display_name":"from: Layne"}',
          message: '{"text":"Can we reset?"}',
          timestampMs: 1767261600000,
        },
        {
          sender_name: '{"label":"to Riley"}',
          message_body: '{"content":"Yes, lets do that."}',
          timestampMs: 1767261720000,
        },
      ],
    })

    const result = runMirrorVeil(input, {
      fileName: 'thread.json',
      options: { enabled: false },
    })

    expect(result.rows).toHaveLength(2)
    expect(result.rows[0]).toMatchObject({
      sender: 'Layne',
      message: 'Can we reset?',
      timestamp: '2026-01-01T10:00:00.000Z',
    })
    expect(result.rows[1]).toMatchObject({
      sender: 'Riley',
      message: 'Yes, lets do that.',
      timestamp: '2026-01-01T10:02:00.000Z',
    })
  })

  it('drops object-placeholder sender/message strings instead of leaking [object Object] into output', () => {
    const input = JSON.stringify({
      messages: [
        {
          sender: '[object Object]',
          message: '[object Object]',
          timestampMs: 1767261600000,
        },
        {
          sender: 'Layne',
          message: 'Can we reset?',
          timestampMs: 1767261720000,
        },
      ],
    })

    const result = runMirrorVeil(input, {
      fileName: 'thread.json',
      options: { enabled: false },
    })

    expect(result.rows).toHaveLength(1)
    expect(result.rows[0]).toMatchObject({
      sender: 'Layne',
      message: 'Can we reset?',
    })
  })

  it('ignores Grey Mirror export metadata header lines in chat-text parsing', () => {
    const input = [
      '# Grey Mirror Messages Export',
      '# Thread: +19186162307',
      '# Exported: 2026-05-27T13:39:03Z',
      '',
      '[2023-01-04T01:32:29Z] +19186162307: Okay',
      '[2023-01-04T01:32:47Z] Layne: Sounds good',
    ].join('\n')

    const result = runMirrorVeil(input, {
      fileName: 'thread.txt',
      options: { enabled: false },
    })

    expect(result.rows).toHaveLength(2)
    expect(result.rows[0]).toMatchObject({
      sender: '+19186162307',
      message: 'Okay',
    })
    expect(result.rows[1]).toMatchObject({
      sender: 'Layne',
      message: 'Sounds good',
    })
  })

  it('parses GraphQL-style edges.node message exports', () => {
    const input = JSON.stringify({
      conversation: {
        messages: {
          edges: [
            {
              node: {
                fromDisplayName: 'Layne',
                bodyText: 'Can we reset?',
                timestampMs: 1767261600000,
              },
            },
            {
              node: {
                fromDisplayName: 'Riley',
                bodyText: 'Yes, lets do that.',
                timestampMs: 1767261720000,
              },
            },
          ],
        },
      },
    })

    const result = runMirrorVeil(input, {
      fileName: 'thread.json',
      options: { enabled: false },
    })

    expect(result.rows).toHaveLength(2)
    expect(result.rows[0]).toMatchObject({
      sender: 'Layne',
      message: 'Can we reset?',
      timestamp: '2026-01-01T10:00:00.000Z',
    })
    expect(result.rows[1]).toMatchObject({
      sender: 'Riley',
      message: 'Yes, lets do that.',
      timestamp: '2026-01-01T10:02:00.000Z',
    })
  })
  it('reports redaction counts broken down by category', () => {
    const input = `timestamp,sender,message
2026-03-24T09:00:00Z,Alice,call me at 555-123-4567 or alice@example.com
2026-03-24T09:05:00Z,Bob,I live at 123 Main St
`

    const result = runMirrorVeil(input, {
      fileName: 'thread.csv',
      options: {
        enabled: true,
        redactNames: true,
        redactPhones: true,
        redactEmails: true,
        redactAddresses: true,
        redactCreditCards: true,
      },
    })

    expect(result.stats.counts.phones).toBe(1)
    expect(result.stats.counts.emails).toBe(1)
    expect(result.stats.counts.addresses).toBe(1)
    expect(result.stats.counts.cards).toBe(0)
    const summed = Object.values(result.stats.counts).reduce((a: number, b: number) => a + b, 0)
    expect(result.stats.redactionsApplied).toBe(summed)
  })
  it('builds a receipt with hashes, counts, and the no-upload statement', async () => {
    const { buildMirrorVeilReceipt } = await import('../src/mirrorVeilStandalone.mjs')
    const input = `timestamp,sender,message
2026-03-24T09:00:00Z,Alice,call me at 555-123-4567
`

    const result = runMirrorVeil(input, {
      fileName: 'thread.csv',
      options: { enabled: true, redactNames: true, redactPhones: true },
    })
    const receipt = await buildMirrorVeilReceipt({ input, result, now: '2026-03-24T10:00:00Z' })

    expect(receipt).toContain('MIRROR VEIL RECEIPT')
    expect(receipt).toContain('phones')
    expect(receipt).toContain('people resolved')
    expect(receipt).toContain('No content left this device.')
    const hashes = receipt.match(/[0-9a-f]{64}/g) || []
    expect(hashes).toHaveLength(2)
    expect(hashes[0]).not.toBe(hashes[1])
  })

  it('produces an identical receipt for identical input', async () => {
    const { buildMirrorVeilReceipt } = await import('../src/mirrorVeilStandalone.mjs')
    const input = `timestamp,sender,message\n2026-03-24T09:00:00Z,Alice,hello\n`
    const options = { enabled: true, redactNames: true }
    const first = await buildMirrorVeilReceipt({
      input, result: runMirrorVeil(input, { options }), now: '2026-03-24T10:00:00Z',
    })
    const second = await buildMirrorVeilReceipt({
      input, result: runMirrorVeil(input, { options }), now: '2026-03-24T10:00:00Z',
    })
    expect(first).toBe(second)
  })

  it('refuses to claim anonymity in the receipt', async () => {
    const { buildMirrorVeilReceipt } = await import('../src/mirrorVeilStandalone.mjs')
    const input = `timestamp,sender,message\n2026-03-24T09:00:00Z,Alice,hello\n`
    const receipt = await buildMirrorVeilReceipt({
      input, result: runMirrorVeil(input, { options: { enabled: true } }), now: '2026-03-24T10:00:00Z',
    })
    expect(receipt).toContain('not a guarantee')
    expect(receipt).not.toMatch(/fully anonymous|guaranteed anonymous|100% anonymous/i)
  })
  it('does not corrupt an email that contains a participant name', () => {
    const input = `timestamp,sender,message
2026-03-24T09:00:00Z,Mike,write to mike@example.com
`

    const result = runMirrorVeil(input, {
      fileName: 'thread.csv',
      options: { enabled: true, redactNames: true, redactEmails: true },
    })

    // Regression: name redaction used to run first and rewrite the local part,
    // leaving the mangled "Person [EMAIL]".
    expect(result.rows[0].message).not.toContain('Person [EMAIL]')
    expect(result.rows[0].message).toMatch(/\[(EMAIL|Person A email)\]/)
  })

  it('links an identifier to the person it belongs to', () => {
    const input = `timestamp,sender,message
2026-03-24T09:00:00Z,Mike <555-123-4567>,here is my number
2026-03-24T09:05:00Z,Sarah,I will call 555-123-4567 tonight
`

    const result = runMirrorVeil(input, {
      fileName: 'thread.csv',
      options: { enabled: true, redactNames: true, redactPhones: true },
    })

    expect(result.rows[1].message).toContain('[Person A phone]')
    expect(result.rows[1].message).not.toContain('[PHONE]')
  })

  it('falls back to a generic token for an unknown identifier', () => {
    const input = `timestamp,sender,message
2026-03-24T09:00:00Z,Mike,call the office at 555-999-0000
`

    const result = runMirrorVeil(input, {
      fileName: 'thread.csv',
      options: { enabled: true, redactNames: true, redactPhones: true },
    })

    expect(result.rows[0].message).toContain('[PHONE]')
  })

  it('refuses to link an identifier shared by two people', () => {
    const input = `timestamp,sender,message
2026-03-24T09:00:00Z,Mike <shared@example.com>,first
2026-03-24T09:05:00Z,Sarah <shared@example.com>,second
2026-03-24T09:10:00Z,Mike,write to shared@example.com
`

    const result = runMirrorVeil(input, {
      fileName: 'thread.csv',
      options: { enabled: true, redactNames: true, redactEmails: true },
    })

    expect(result.rows[2].message).toContain('[EMAIL]')
    expect(result.rows[2].message).not.toContain('Person A email')
    expect(result.rows[2].message).not.toContain('Person B email')
  })
  it('links a diminutive of a known name to the same person', () => {
    const input = `timestamp,sender,message
2026-03-24T09:00:00Z,Mike,hello
2026-03-24T09:05:00Z,Sarah,mikey are you coming
`

    const result = runMirrorVeil(input, {
      fileName: 'thread.csv',
      options: { enabled: true, redactNames: true },
    })

    expect(result.rows[1].message).toContain('Person A')
    expect(result.rows[1].message.toLowerCase()).not.toContain('mikey')
  })

  it('links a table diminutive to the same person', () => {
    const input = `timestamp,sender,message
2026-03-24T09:00:00Z,Robert,hello
2026-03-24T09:05:00Z,Sarah,bob said no
`

    const result = runMirrorVeil(input, {
      fileName: 'thread.csv',
      options: { enabled: true, redactNames: true },
    })

    expect(result.rows[1].message).toContain('Person A')
    expect(result.rows[1].message.toLowerCase()).not.toContain('bob')
  })

  it('does not invent links for unrelated names', () => {
    const input = `timestamp,sender,message
2026-03-24T09:00:00Z,Mike,hello
2026-03-24T09:05:00Z,Sarah,michelle said no
`

    const result = runMirrorVeil(input, {
      fileName: 'thread.csv',
      options: { enabled: true, redactNames: true },
    })

    expect(result.rows[1].message.toLowerCase()).toContain('michelle')
  })
  it('publishes the preserved and removed contract', async () => {
    const { MIRROR_VEIL_CONTRACT } = await import('../src/mirrorVeilStandalone.mjs')
    expect(MIRROR_VEIL_CONTRACT.removed).toContain('Names, nicknames, and handles')
    expect(MIRROR_VEIL_CONTRACT.preserved).toContain('Timestamps and the gaps between messages')
  })

  it('preserves timing, order, and wording through redaction', () => {
    const input = `timestamp,sender,message
2026-03-24T09:00:00Z,Alice,call me at 555-123-4567 please
2026-03-24T11:30:00Z,Bob,ok
`

    const result = runMirrorVeil(input, {
      fileName: 'thread.csv',
      options: { enabled: true, redactNames: true, redactPhones: true },
    })

    expect(result.rows[0].timestamp).toBe('2026-03-24T09:00:00.000Z')
    expect(result.rows[1].timestamp).toBe('2026-03-24T11:30:00.000Z')
    expect(result.rows).toHaveLength(2)
    expect(result.rows[0].message).toContain('call me at')
    expect(result.rows[0].message).toContain('please')
  })
})
