# Testing

There is no automated GNOME Shell UI test harness; shell code cannot run outside a shell session.
What can be tested standalone is covered by two layers.

## 1. Standalone (no GNOME Shell needed)

```bash
gjs -m tests/smoke.js        # runs the real monitors against this machine
bash scripts/validate.sh     # metadata, schema, JS syntax, imports, and the smoke test
```

`smoke.js` checks the formatting helpers, then reads real CPU, RAM, uptime, temperature, GPU and
Bluetooth data and asserts that values are well-formed and plausible (e.g. 0–100 %, used ≤ total).
A machine without a temperature sensor or Bluetooth device is a valid result, not a failure.

## 2. Inside GNOME Shell (manual)

The panel UI, dropdown and preferences window can only be verified in a live session.
See "Testing each monitor" in the top-level README for the per-metric procedure.
