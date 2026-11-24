# Mirror Veil

**Redact a conversation before you share it — with a lawyer, a therapist, or an AI.**

Mirror Veil is a single HTML file. You download it and open it. There is no upload, no
account, and no server, because there is nothing to upload *to*. Disconnect from the
internet and it still works, which is the simplest way to verify that claim instead of
trusting a privacy policy.

📄 **[Download the tool](https://github.com/justlayme/mirror-veil/raw/main/dist/MirrorVeil.html)** ·
🌐 [Project page](https://thegreymirror.com/mirror-veil)

---

## Why this exists

Preparing a conversation locally lets you inspect what you will share before
sending it to another person or service.

And the tools that don't upload usually redact *per pattern*, which quietly destroys the
conversation: "Mike", "Mikey", and his phone number become three unrelated blanks, and
nobody reading the result can follow who said what.

## What makes it different

### 1. One person stays one person

Mirror Veil builds an alias graph and maps every identifier belonging to one person to a
single stable token.

```
BEFORE
  Mike <555-123-4567>: call me at 555-123-4567 or mike@example.com
  Sarah:               mikey did you tell jen?

TYPICAL PATTERN-BASED TOOL
  [NAME]: call me at [PHONE] or [EMAIL]
  [NAME]: [NAME] did you tell [NAME]?

MIRROR VEIL
  Person A: call me at [Person A phone] or [Person A email]
  Person B: Person A did you tell jen?
```

"jen" is left alone on purpose — she is not a participant, and the tool does not invent
links it cannot justify.

**Ambiguity rule:** if an identifier could belong to two different people, Mirror Veil
refuses to link it and falls back to a generic token. Silently merging two people is a
worse failure than leaving one unlinked.

### 2. A verifiable redaction receipt

Every run can emit a receipt:

```
MIRROR VEIL RECEIPT

  tool             Mirror Veil 20260812a
  input  sha256    3e1013c32066cd50becb0bc44a3b05437415d9b335ee32999f546d1690575141
  output sha256    53b0118189c2553f006ae6497406a68bcb2fc2292b9ceac8588e088d55879201

  REMOVED
  names          1
  emails         1
  phones         1
  addresses      1

  people resolved  2

  No content left this device.
```

It records **what was removed**, without revealing any of it. That matters when a third
party has to trust a file you handed them.

It is **not** a certificate of anonymity, and the receipt says so.

### 3. Context-preserving by design

| Removed | Preserved |
| --- | --- |
| Names, nicknames, handles | Timestamps and gaps between messages |
| Phone numbers, emails | Who spoke when, turn-taking order |
| Street addresses | Message length |
| Card numbers (Luhn-checked) | Wording that carries tone and emotion |
| Links (optional) | |

Keeping the structure is deliberate: the parts that carry meaning are not the parts that
identify people, so a redacted file is still readable and still analyzable.

## Honest limits

Redaction is never perfect.

- Context can still identify someone — a specific event, an unusual phrase, a detail only
  two people would know.
- A nickname with no derivable link to a name will be missed. Nickname matching is
  deliberately narrow (exact match, diminutive suffixes like Mike→Mikey, and a small table
  for forms like Robert→Bob). General name knowledge is unbounded, so it is not attempted.
- **Read the cleaned file before you share it.** This is a strong first pass, not a
  guarantee.

## Supported inputs

WhatsApp `.txt`/`.csv` exports, iMessage CSV/JSON, Instagram JSON data exports, and most
CSV, JSON, or timestamped text transcripts.

Output is a CSV with `timestamp,sender,message`.

## Analyze a cleaned conversation

If your next step is understanding relationship patterns, Wentropy Labs also builds
[Grey Mirror's full-conversation text analyzer](https://thegreymirror.com/grey-mirror/relationship-text-analysis).
It measures timing, reciprocity, repair and change, with findings linked to
supporting messages. The analysis and a preview of four evidence-linked findings
are free, with no card required. An optional full report is $17.99 once, or
Grey Mirror Plus is $9.99/month for one full report each paid month; see the
[current report access and pricing](https://thegreymirror.com/pricing).

Mirror Veil does not send a cleaned file to Grey Mirror automatically. You choose
whether to upload it, and Grey Mirror's separate
[privacy and deletion policy](https://thegreymirror.com/grey-mirror/privacy-and-deletion)
applies if you do. Review the cleaned text first: removing identifiers does not
remove every identifying detail from a conversation.

## Development

```bash
npm install
npm test          # vitest
npm run build     # regenerates dist/MirrorVeil.html
```

`dist/MirrorVeil.html` is a generated artifact — edit `src/`, then rebuild. The build
inlines the engine into a single self-contained file with no external requests.

### Notes on the implementation

- **SHA-256 is implemented in plain JS** (`src/mirrorVeilSha256.mjs`), verified against the
  NIST known-answer vectors. `crypto.subtle` is used only as a fast path, because it is not
  reliably available on `file://` origins — which is exactly where this tool runs.
- Structured identifiers are resolved **before** free-text names. Reversing that order
  rewrites the local part of `mike@example.com` and leaves a mangled `Person [EMAIL]`.
- Person numbering counts distinct tokens, not registry entries, so alias keys never
  consume a person label.

## Who made it

Built by [Wentropy Labs](https://thegreymirror.com/company/wentropy-labs), which also makes
[The Grey Mirror](https://thegreymirror.com/grey-mirror), a relationship text analyzer. Mirror Veil is
free and standalone — it does not require Grey Mirror, and a cleaned file works with any
tool that reads a CSV.

## License

MIT

---

**Built by [Wentropy Labs](https://wentropylabs.com)** · [Grey Mirror](https://thegreymirror.com), the flagship text message analyzer for relationships · [Unbubble](https://thegreymirror.com/grey-mirror/unbubble), the 100% on-device iPhone message exporter · [Textimony](https://textimony.io) · [LinkedIn](https://www.linkedin.com/company/wentropy-labs) · [Crunchbase](https://www.crunchbase.com/organization/wentropy-labs)
