<script lang="ts">
  import { sign } from "../lib/sign-client.ts";
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
  };

  let { labels, apiBase, powBits }: { labels: Labels; apiBase: string; powBits: number } = $props();

  let nia = $state("");
  let initials = $state("");
  let comment = $state("");
  let consent = $state(false);
  let phase = $state<"idle" | "hashing" | "proof_of_work" | "submitting" | "ok" | "duplicate" | "error">("idle");
  let errorMessage = $state("");
  let signatureToken = $state<string | null>(null);

  let normalised = $derived(normalize(nia));
  let niaValid = $derived(isValid(normalised));
  let busy = $derived(phase === "hashing" || phase === "proof_of_work" || phase === "submitting");
  let canSubmit = $derived(niaValid && consent && !busy);

  async function handleSubmit(e: Event) {
    e.preventDefault();
    if (!canSubmit) return;
    phase = "hashing";
    errorMessage = "";
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
  <h1>{labels.title}</h1>
  <p class="eligibility">{labels.eligibility}</p>

  {#if phase === "ok"}
    <div class="success">
      <h2>{labels.successTitle}</h2>
      {#if signatureToken}
        <p>Signature token: <code>{signatureToken}</code></p>
      {/if}
    </div>
  {:else if phase === "duplicate"}
    <div class="duplicate">
      <h2>{labels.duplicateTitle}</h2>
      <p>{labels.duplicateBody}</p>
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

      <button type="submit" disabled={!canSubmit}>
        {#if phase === "hashing"}Argon2id…
        {:else if phase === "proof_of_work"}Proof-of-work…
        {:else if phase === "submitting"}…
        {:else}{labels.cta}{/if}
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
</style>
