<script lang="ts">
  import { onMount } from "svelte";
  import { sign, deleteSignature } from "../lib/sign-client.ts";
  import { isValid, normalize } from "@referendum-ja/crypto";

  type Labels = {
    title: string;
    eligibility: string;
    niaLabel: string;
    niaHelp: string;
    niaPrivacy: string;
    initialsLabel: string;
    commentLabel: string;
    rgpdConsent: string;
    cta: string;
    computingNote: string;
    successTitle: string;
    duplicateTitle: string;
    duplicateBody: string;
    deleteTitle: string;
    deleteBody: string;
    deleteCta: string;
    deleteOk: string;
    deleteNotFound: string;
    tokenWarningTitle: string;
    tokenWarningBody: string;
  };

  let { labels, apiBase, powBits }: { labels: Labels; apiBase: string; powBits: number } = $props();

  let mode = $state<"sign" | "delete">("sign");
  let nia = $state("");
  let initials = $state("");
  let comment = $state("");
  let consent = $state(false);
  let phase = $state<
    "idle" | "hashing" | "proof_of_work" | "submitting" | "ok" | "duplicate" | "deleted" | "not_found" | "error"
  >("idle");
  let errorMessage = $state("");
  let signatureToken = $state<string | null>(null);

  onMount(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("action") === "delete") mode = "delete";
  });

  let normalised = $derived(normalize(nia));
  let niaValid = $derived(isValid(normalised));
  let busy = $derived(phase === "hashing" || phase === "proof_of_work" || phase === "submitting");
  let canSubmit = $derived(niaValid && !busy && (mode === "delete" || consent));

  async function handleSubmit(e: Event) {
    e.preventDefault();
    if (!canSubmit) return;
    phase = "hashing";
    errorMessage = "";
    if (mode === "delete") {
      const result = await deleteSignature({ nia, apiBase, powBits }, (p) => {
        phase = p as typeof phase;
      });
      if (result.status === "deleted") phase = "deleted";
      else if (result.status === "not_found") phase = "not_found";
      else if (result.status === "rate_limited") {
        phase = "error";
        errorMessage = "rate_limited";
      } else {
        phase = "error";
        errorMessage = result.message;
      }
      nia = "";
      return;
    }
    const result = await sign({ nia, initials, comment, apiBase, powBits }, (p) => {
      phase = p as typeof phase;
    });
    if (result.status === "ok") {
      phase = "ok";
      signatureToken = result.signatureToken;
      nia = "";
    } else if (result.status === "duplicate") {
      phase = "duplicate";
    } else if (result.status === "rate_limited") {
      phase = "error";
      errorMessage = "rate_limited";
    } else {
      phase = "error";
      errorMessage = result.message;
    }
  }
</script>

<section class="sign">
  <h1>{mode === "delete" ? labels.deleteTitle : labels.title}</h1>
  <p class="eligibility">{mode === "delete" ? labels.deleteBody : labels.eligibility}</p>

  {#if phase === "ok"}
    <div class="success">
      <h2>{labels.successTitle}</h2>
      {#if signatureToken}
        <details class="token-details">
          <summary>{labels.tokenWarningTitle}</summary>
          <p class="token-warning">⚠️ {labels.tokenWarningBody}</p>
          <code class="token">{signatureToken}</code>
        </details>
      {/if}
    </div>
  {:else if phase === "duplicate"}
    <div class="duplicate">
      <h2>{labels.duplicateTitle}</h2>
      <p>{labels.duplicateBody}</p>
    </div>
  {:else if phase === "deleted"}
    <div class="success">
      <h2>{labels.deleteOk}</h2>
    </div>
  {:else if phase === "not_found"}
    <div class="duplicate">
      <h2>{labels.deleteNotFound}</h2>
    </div>
  {:else}
    <form onsubmit={handleSubmit}>
      <label>
        <span>{labels.niaLabel}</span>
        <input
          type="text"
          inputmode="text"
          autocomplete="off"
          autocapitalize="characters"
          spellcheck="false"
          maxlength="16"
          bind:value={nia}
          aria-invalid={nia.length > 0 && !niaValid}
        />
        <small class="hint">{labels.niaHelp}</small>
        <small class="privacy">🔒 {labels.niaPrivacy}</small>
      </label>

      {#if mode === "sign"}
        <label>
          <span>{labels.initialsLabel}</span>
          <input type="text" maxlength="4" bind:value={initials} autocomplete="off" />
        </label>

        <label>
          <span>{labels.commentLabel}</span>
          <textarea maxlength="280" rows="3" bind:value={comment}></textarea>
          <small>{comment.length} / 280</small>
        </label>

        <label class="consent">
          <input type="checkbox" bind:checked={consent} />
          <span>{labels.rgpdConsent}</span>
        </label>
      {/if}

      <button type="submit" disabled={!canSubmit}>
        {#if phase === "hashing"}Argon2id…
        {:else if phase === "proof_of_work"}Proof-of-work…
        {:else if phase === "submitting"}…
        {:else}{mode === "delete" ? labels.deleteCta : labels.cta}{/if}
      </button>

      <small class="computing">{labels.computingNote}</small>
      {#if phase === "error"}
        <p class="error">Error: {errorMessage}</p>
      {/if}
    </form>
  {/if}
</section>

<style>
  .sign { max-width: 36rem; margin: 0 auto; }
  label { display: block; margin: 1rem 0; }
  label span { display: block; font-weight: 600; margin-bottom: 0.25rem; }
  input[type="text"], textarea {
    width: 100%; padding: 0.6rem; font-size: 1rem;
    border: 1px solid #888; border-radius: 4px; background: #fff;
  }
  input[aria-invalid="true"] { border-color: #c00; }
  .hint, .privacy, .computing { display: block; font-size: 0.85rem; color: #555; margin-top: 0.25rem; }
  .privacy { color: #2a6; }
  .consent { display: flex; align-items: flex-start; gap: 0.5rem; }
  .consent span { font-weight: normal; }
  button { padding: 0.8rem 1.2rem; font-size: 1rem; font-weight: 600; cursor: pointer; }
  button:disabled { opacity: 0.5; cursor: not-allowed; }
  .success, .duplicate { padding: 1rem; border-radius: 6px; }
  .success { background: #e6f7ec; }
  .duplicate { background: #fdf2e6; }
  .error { color: #c00; }
  .token-details { margin-top: 1rem; padding: 0.75rem; background: #fff8e6;
                   border-left: 3px solid #c80; border-radius: 4px; }
  .token-details summary { cursor: pointer; font-weight: 600; }
  .token-warning { font-size: 0.9rem; margin: 0.75rem 0; }
  .token { display: block; word-break: break-all; font-size: 0.75rem;
           background: #fff; padding: 0.5rem; border-radius: 3px;
           font-family: ui-monospace, "SF Mono", Menlo, monospace; }
</style>
