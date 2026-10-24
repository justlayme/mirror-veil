# Security and threat model — Mirror Veil

> **Sync note.** This document is maintained alongside the Mirror Veil source. If you are
> reading it in the repository, this is the published copy; the upstream original lives with
> the implementation and the two are kept in sync by hand.

Last reviewed: 2026-08-28 · Applies to: Mirror Veil, all versions · Licence: MIT

---

## 1. What Mirror Veil is

Mirror Veil removes identifying details from a conversation export before you hand it to
somebody else — a lawyer, a therapist, an insurer, or an AI assistant.

It is a single HTML file. You download it and open it in a browser. There is no upload, no
account, and no server, because there is nothing to upload *to*. It is not a service, it has
no backend, and it does not need one.

It reads exports from iMessage, WhatsApp, Instagram DMs and Android SMS, plus plain CSV,
JSON, TXT and HTML transcripts.

## 2. Threat model

**Who this protects you from.** The person or system you are about to hand a conversation
to. That is the whole design goal: you have decided to share a thread, and you want the
other party to be able to read what happened without learning who it happened to.

Concretely, it is built for these situations:

- Sending a conversation to a solicitor or therapist who needs the substance, not the names.
- Pasting a thread into a hosted AI assistant, where the text may be retained or used.
- Filing a conversation with an insurer, an employer, or a platform's abuse team.
- Uploading a history to a third-party analysis tool, Grey Mirror included.

**What it assumes.** That your own device and browser are trustworthy. Mirror Veil runs
inside your browser, so it inherits that browser's security. If the machine is already
compromised — malware, a hostile extension with page access, a keylogger — Mirror Veil
cannot help you, and no client-side tool can.

**Who this does not protect you from.** Anyone who already has the original, unredacted
conversation. Redacting your copy does nothing to the copy on the other participant's phone
or on the platform's servers.

## 3. Local-only processing

All parsing, redaction, and hashing happen in the page, on your device.

This is verifiable rather than promised. Two ways to check it yourself, in increasing order
of rigour:

1. **Disconnect from the internet and use it.** It works unchanged. That is a faster and
   more convincing test than reading any privacy policy.
2. **Open the file in a text editor, or watch your browser's network tab.** The shipped file
   is fully self-contained: it loads no external scripts, styles, fonts or images, and it
   contains no `fetch`, `XMLHttpRequest`, `WebSocket`, or `navigator.sendBeacon` call. There
   is no code path that could transmit anything.

Because it is one file with no external references, there is also no CDN, no analytics
vendor, and no font host that could observe usage by side effect.

## 4. What does not leave the browser

Nothing does. Specifically, none of the following is transmitted, logged, or persisted to
any remote system:

- The conversation you load, in original or redacted form.
- Participant names, nicknames, handles, phone numbers, email addresses, or street
  addresses.
- The SHA-256 hashes in the receipt.
- Counts, statistics, telemetry, crash reports, or usage pings — none of these exist.

Output files (the redacted conversation and the receipt) are produced as in-memory blobs and
saved by your own browser's download mechanism.

## 5. The SHA-256 receipt

Every run can emit a plain-text receipt recording:

- The tool name and version.
- The processing timestamp.
- **SHA-256 of the input** and **SHA-256 of the output**.
- Per-category counts of what was removed.
- How many distinct people were resolved.

The two hashes let you prove later which exact input produced which exact output — useful if
a redacted conversation is challenged, or if you need to show you shared a specific version
and nothing else. Recompute either hash with any standard tool and compare.

The hashes are computed locally. The receipt carries this line verbatim, and it is the
honest framing:

> This receipt records what the tool removed. It is not a guarantee of anonymity: context
> can still identify people. Review before sharing.

**Implementation note.** Hashing uses a pure-JavaScript SHA-256 (verified against NIST test
vectors), with `crypto.subtle` used only as a fast path where available. This is deliberate:
`crypto.subtle` is unavailable or unreliable in `file://` contexts, which is exactly how this
tool is meant to be opened. Do not "simplify" it back to WebCrypto alone.

## 6. The alias graph, and why stable tokens matter

Pattern-based redactors replace each match independently. That destroys the conversation:
"Mike", "Mikey", his phone number and his email become four unrelated blanks, and whoever
reads the result can no longer follow who said what — which defeats the purpose of sharing
it.

Mirror Veil builds an alias graph instead, mapping every identifier belonging to one person
to a single stable token:

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

**The ambiguity rule.** If an identifier could belong to two different people, Mirror Veil
refuses to link it and falls back to a generic token. Silently merging two people is a worse
failure than leaving one unlinked, because a merge fabricates a relationship that was never
in the data.

Note that "jen" above is deliberately left alone: she is not a participant, and the tool does
not invent links it cannot justify.

**What it removes:** names, nicknames and handles; phone numbers; email addresses; street
addresses; card numbers passing a Luhn check; and links, if you enable that option.

**What it deliberately keeps:** timestamps and the gaps between messages; who spoke when and
in what order; message lengths; and the wording that carries tone and emotion. These are
preserved because removing them would make the conversation useless to the person you are
sharing it with.

## 7. Known limitations

- **Redaction is not anonymisation.** Preserved content can still identify someone. A named
  employer, an unusual event, a specific address described in prose, or a distinctive turn of
  phrase will survive, because the tool keeps wording intact by design.
- **Detection is heuristic.** Unusual name spellings, transliterations, in-jokes used as
  names, and international number or address formats not covered by the patterns can be
  missed. There is no model that catches every identifier in free text.
- **Only participants get stable tokens.** Third parties mentioned in passing are treated
  conservatively and may be left in place, as with "jen" above.
- **Non-text content is out of scope.** Images, attachments, voice notes and their metadata
  are not inspected or redacted.
- **Very large exports are bounded by your device.** Everything runs in one browser tab, so
  memory is the practical ceiling.
- **The receipt proves integrity, not completeness.** It shows what was removed, not that
  nothing identifying remains.

**Always read the output before you share it.** The tool is an assistant, not a guarantee.

## 8. Risks this does not solve

- It does not protect the other participant's copy of the conversation, or the platform's.
- It does not defend a compromised device, browser, or extension.
- It does not encrypt anything, and it is not a secure transport. How you send the redacted
  file is a separate problem.
- It does not establish that a conversation is authentic or unedited. The receipt binds an
  input to an output; it says nothing about whether the input was genuine.
- It does not provide legal privilege, admissibility, or compliance with any specific
  regulation. No SOC 2, HIPAA, GDPR or ISO claim is made or implied.
- It does not de-identify against a determined adversary who already knows the context.

## 9. Safe use

1. Run it offline the first time. Confirm for yourself that it works with the network off.
2. **Read the redacted output before sharing.** Look specifically for surviving context:
   employers, place names, dates tied to public events, unique incidents.
3. Enable link removal when URLs might identify accounts or locations.
4. Keep the receipt if the redaction might later be questioned.
5. Share the redacted file over a channel you already trust; Mirror Veil does not secure
   transmission.
6. Prefer the copy you built or downloaded yourself over one someone sent you. Verify it
   against the published repository if in doubt.
7. If the conversation involves immediate danger, contact the relevant emergency or support
   service. This is a redaction utility, not a safety tool.

## 10. Reporting a vulnerability

Email **security@justlay.me** with the details. Please include what you found, how to
reproduce it, and what you think the impact is.

- We aim to acknowledge within 5 working days.
- Please give us a reasonable window to ship a fix before publishing.
- Public exploit details are not needed in the first report — a description of the class of
  problem is enough to get started.

Findings that are especially welcome: an identifier class the redactor misses, a way to make
the alias graph merge two distinct people, any code path that could cause data to leave the
device, and any error in the SHA-256 implementation.

Please do not file vulnerability reports as public GitHub issues.

## 11. Versions and updates

The tool version and processing timestamp are stamped into every receipt, so any output can
be traced back to the build that produced it.

Source and release history: `https://github.com/justlayme/mirror-veil` (MIT).
Project page: `https://thegreymirror.com/mirror-veil`.

Because the tool is a single downloaded file, an existing copy keeps working exactly as it
did and never auto-updates. That is intentional — nothing phones home to check for a new
version. Re-download to pick up improvements, particularly to identifier detection.
