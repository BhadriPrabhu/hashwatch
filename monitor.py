import hashlib
import json
import os
import requests
from bs4 import BeautifulSoup

PROXY_URL = os.environ["PROXY_URL"]
PROXY_SECRET = os.environ["PROXY_SECRET"]
WEBHOOK_URL = os.environ["WEBHOOK_URL"]
PINGBOX_SECRET = os.environ["PINGBOX_SECRET"]

STATE_FILE = "state.json"

def load_json(path, default):
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    return default

def send_alert(title, message, url="/", topic="general"):
    res = requests.post(
        WEBHOOK_URL,
        json={
            "topic": topic,
            "title": title,
            "body": message,
            "url": url
        },
        headers={"x-api-key": PINGBOX_SECRET},
        timeout=15
    )
    res.raise_for_status()

def fetch_page(url, use_proxy=True):
    if use_proxy:
        res = requests.get(
            PROXY_URL,
            params={"url": url},
            headers={"x-api-key": PROXY_SECRET},
            timeout=25
        )
    else:
        res = requests.get(url, timeout=20)
    res.raise_for_status()
    return res.text

def fetch_targets():
    targets_url = PROXY_URL.replace("/api/fetch", "/api/targets")
    res = requests.get(
        targets_url,
        headers={"x-api-key": PROXY_SECRET},
        timeout=15
    )
    res.raise_for_status()
    return res.json()

def main():
    targets = fetch_targets()
    state = load_json(STATE_FILE, {})
    state_changed = False

    for target in targets:
        name = target["name"]
        url = target["url"]
        selector = target.get("selector", "body")
        keywords = target.get("keywords", [])
        use_proxy = target.get("use_proxy", True)
        topic = target.get("topic", "general")

        print(f"Checking: {name}...", flush=True)
        try:
            html = fetch_page(url, use_proxy)
            soup = BeautifulSoup(html, "html.parser")
            section = soup.select_one(selector) or soup
            text = section.get_text(" ", strip=True).lower()

            current_hash = hashlib.sha256(text.encode("utf-8")).hexdigest()
            previous_hash = state.get(name)

            if previous_hash is None:
                print(f"  -> Baseline saved for {name} (silent init).", flush=True)
                state[name] = current_hash
                state_changed = True
            elif current_hash != previous_hash:
                found = [kw for kw in keywords if kw.lower() in text]
                print(f"  -> CHANGE DETECTED for {name}! Keywords: {found}", flush=True)
                state[name] = current_hash
                state_changed = True

                msg = f"{name} updated!\nKeywords matched: {found}"
                send_alert(f"HashWatch: {name}", msg, url, topic)
            else:
                print(f"  -> No changes for {name}.", flush=True)

        except Exception as e:
            print(f"  -> Error checking {name}: {e}", flush=True)

    if state_changed:
        with open(STATE_FILE, "w", encoding="utf-8") as f:
            json.dump(state, f, indent=2)

if __name__ == "__main__":
    main()
