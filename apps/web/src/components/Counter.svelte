<script lang="ts">
  import { onMount } from "svelte";

  let { apiBase, label }: { apiBase: string; label: string } = $props();
  let total = $state<number | null>(null);

  onMount(async () => {
    try {
      const res = await fetch(`${apiBase}/api/stats`);
      const body = (await res.json()) as { total: number };
      total = body.total;
    } catch {
      total = null;
    }
  });
</script>

<div class="counter">
  <div class="big">{total === null ? "…" : total.toLocaleString("ca-AD")}</div>
  <div class="label">{label}</div>
</div>

<style>
  .counter { text-align: center; padding: 1.5rem 0; }
  .big { font-size: 3.5rem; font-weight: 800; line-height: 1; }
  .label { font-size: 1rem; color: #555; margin-top: 0.5rem; }
</style>
