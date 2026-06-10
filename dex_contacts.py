#!/usr/bin/env python3
"""Fetch your Dex (getdex.com) contacts / connections.

Usage:
    export DEX_API_KEY="your_freshly_rotated_key"
    python3 dex_contacts.py                # print a summary table
    python3 dex_contacts.py --json > out.json   # dump raw JSON

The API key is read from the DEX_API_KEY environment variable so it never
lives in the source code. Never paste your key into chat or commit it.

Docs: https://getdex.com/docs/api-reference
"""

import json
import os
import sys
import urllib.error
import urllib.request

# Dex's REST API. If your account/docs show a different host, override with
# the DEX_API_BASE env var (e.g. https://api.prod.getdex.com/v1).
BASE_URL = os.environ.get("DEX_API_BASE", "https://api.getdex.com/api/rest")
PAGE_SIZE = 100


def _request(path, api_key):
    url = f"{BASE_URL}{path}"
    req = urllib.request.Request(url)
    # Dex has used both an API-key header and Bearer auth across versions.
    # We send both; the server ignores the one it doesn't need.
    req.add_header("x-hasura-dex-api-key", api_key)
    req.add_header("Authorization", f"Bearer {api_key}")
    req.add_header("Accept", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", "replace")
        sys.exit(f"HTTP {e.code} from {url}\n{body}")
    except urllib.error.URLError as e:
        sys.exit(f"Network error contacting {url}: {e.reason}")


def fetch_all_contacts(api_key):
    contacts = []
    offset = 0
    while True:
        data = _request(f"/contacts?limit={PAGE_SIZE}&offset={offset}", api_key)
        page = data.get("contacts", data if isinstance(data, list) else [])
        if not page:
            break
        contacts.extend(page)
        if len(page) < PAGE_SIZE:
            break
        offset += PAGE_SIZE
    return contacts


def main():
    api_key = os.environ.get("DEX_API_KEY")
    if not api_key:
        sys.exit("Set DEX_API_KEY first:  export DEX_API_KEY='your_key'")

    contacts = fetch_all_contacts(api_key)

    if "--json" in sys.argv:
        json.dump(contacts, sys.stdout, indent=2, ensure_ascii=False)
        return

    print(f"Total contacts: {len(contacts)}\n")
    for c in contacts:
        name = " ".join(filter(None, [c.get("first_name"), c.get("last_name")])) or "(no name)"
        title = c.get("job_title") or ""
        emails = c.get("emails") or []
        email = emails[0].get("email") if emails and isinstance(emails[0], dict) else (emails[0] if emails else "")
        line = name
        if title:
            line += f" — {title}"
        if email:
            line += f" <{email}>"
        print(line)


if __name__ == "__main__":
    main()
