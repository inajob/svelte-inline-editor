<script lang="ts">
  import TextEditor from './TextEditor.svelte';
</script>

<main>
  <h1>Editor 1</h1>
  <TextEditor debugMode={true} />

  <h1>Editor 2</h1>
  <TextEditor initialLines={[
    { id: 1, text: "## This is a second editor" },
    { id: 2, text: "It has its own content." },
    { id: 3, text: "And debug mode is off by default." }
  ]} />
</main>

<style>
  * {
    margin: 0;
    padding: 0;
  }
</style>
