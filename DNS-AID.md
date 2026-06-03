# DNS for AI Discovery (DNS-AID) Records

This document specifies the DNS for AI Discovery (DNS-AID) records that should be published for `recalledrides.com`.

## Required DNS Records

Add the following SVCB/HTTPS records to your DNS provider (e.g., Cloudflare):

```dns
; Agent index endpoint
_index._agents.recalledrides.com. 3600 IN SVCB 1 recalledrides.com. alpn="h2,h3" port=443 mandatory=alpn,port

; A2A endpoint (if applicable)
_a2a._agents.recalledrides.com. 3600 IN SVCB 1 recalledrides.com. alpn="h2,h3" port=443 mandatory=alpn,port

; HTTPS variant for modern resolvers
_index._agents.recalledrides.com. 3600 IN HTTPS 1 recalledrides.com. alpn="h2,h3" port=443 mandatory=alpn,port
```

## DNSSEC

Ensure the `recalledrides.com` zone is signed with DNSSEC so validating resolvers return authenticated data for the `_agents` subtree.

## Verification

After publishing, verify with:

```bash
dig SVCB _index._agents.recalledrides.com @1.1.1.1
dig HTTPS _index._agents.recalledrides.com @1.1.1.1
```

## References

- [DNS-AID Draft](https://datatracker.ietf.org/doc/draft-mozleywilliams-dnsop-dnsaid/)
- [RFC 9460 — SVCB and HTTPS Resource Records](https://www.rfc-editor.org/rfc/rfc9460)
