(() => {
  const root = document.querySelector("[data-comments]");
  if (!root) return;
  const zh = document.documentElement.lang.startsWith("zh");
  const text = zh
    ? {
        loading: "正在加载评论…",
        empty: "还没有评论，欢迎分享你的想法。",
        failed: "暂时无法加载评论，请重试。",
        retry: "重试",
        more: "加载更多",
        posting: "正在发表…",
        submit: "发表评论",
        success: "评论已发表，谢谢你的分享。",
        error: "发表评论失败，请重试。你填写的内容已保留。",
        limited: "发表得有些频繁，请稍后再试。",
        invalid: "请填写姓名和评论内容。",
      }
    : {
        loading: "Loading comments…",
        empty: "No comments yet. Be the first to share a thought.",
        failed: "Comments could not be loaded. Please try again.",
        retry: "Try again",
        more: "Load more",
        posting: "Posting…",
        submit: "Post comment",
        success: "Your comment is posted. Thank you for sharing.",
        error: "Your comment could not be posted. Please try again; your text has been kept.",
        limited: "You are posting a little quickly. Please try again later.",
        invalid: "Please enter your name and comment.",
      };
  const form = root.querySelector("form");
  const name = form.elements.namedItem("name");
  const content = form.elements.namedItem("content");
  const submit = root.querySelector(".comment-submit");
  const status = root.querySelector(".comment-status");
  const loading = root.querySelector(".comments-loading");
  const list = root.querySelector(".comments-list");
  const more = root.querySelector(".comments-more");
  const endpoint = root.dataset.endpoint;
  const article = root.dataset.article;
  const seen = new Set();
  let cursor = null;
  let isLoading = false;
  let pending = null;

  async function request(url, options = {}) {
    const response = await fetch(url, { ...options, credentials: "omit", signal: AbortSignal.timeout(15000) });
    const body = await response.json();
    if (!response.ok) throw Object.assign(new Error(body.error || "unavailable"), { status: response.status });
    return body;
  }

  function render(comment, prepend = false) {
    if (seen.has(comment.id)) return;
    seen.add(comment.id);
    const item = document.createElement("li");
    item.className = "comment-item";
    item.dataset.commentId = comment.id;
    const meta = document.createElement("div");
    meta.className = "comment-meta";
    const author = document.createElement("span");
    author.className = "comment-name";
    author.textContent = comment.name;
    const time = document.createElement("time");
    time.className = "comment-date";
    const date = new Date(comment.createdAt);
    time.dateTime = date.toISOString();
    time.textContent = new Intl.DateTimeFormat(zh ? "zh-CN" : "en", { dateStyle: "medium", timeStyle: "short" }).format(date);
    const body = document.createElement("p");
    body.className = "comment-content";
    body.textContent = comment.content;
    meta.append(author, time);
    item.append(meta, body);
    if (prepend) list.prepend(item);
    else list.append(item);
  }

  async function load() {
    if (isLoading) return;
    isLoading = true;
    more.disabled = true;
    loading.textContent = text.loading;
    try {
      const url = new URL(endpoint);
      url.searchParams.set("article", article);
      if (cursor !== null) url.searchParams.set("before", cursor);
      const data = await request(url);
      data.comments.forEach((comment) => render(comment));
      cursor = data.nextCursor;
      loading.textContent = seen.size ? "" : text.empty;
      more.hidden = cursor === null;
      more.textContent = text.more;
    } catch {
      loading.textContent = text.failed;
      more.hidden = false;
      more.textContent = text.retry;
    } finally {
      isLoading = false;
      more.disabled = false;
    }
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (submit.disabled) return;
    const cleanName = name.value.trim();
    const cleanContent = content.value.trim();
    if (!cleanName || !cleanContent) {
      status.textContent = text.invalid;
      status.dataset.error = "true";
      (!cleanName ? name : content).focus();
      return;
    }
    if (!pending || pending.name !== cleanName || pending.content !== cleanContent) {
      pending = { article, name: cleanName, content: cleanContent, requestId: crypto.randomUUID() };
    }
    submit.disabled = true;
    submit.textContent = text.posting;
    status.textContent = "";
    status.dataset.error = "false";
    try {
      const data = await request(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pending),
      });
      render(data.comment, true);
      // Keep any new draft typed while the request was in flight.
      if (content.value.trim() === cleanContent) content.value = "";
      pending = null;
      status.textContent = text.success;
      loading.textContent = "";
    } catch (error) {
      status.textContent = error.status === 429 ? text.limited : text.error;
      status.dataset.error = "true";
    } finally {
      submit.disabled = false;
      submit.textContent = text.submit;
    }
  });
  more.addEventListener("click", load);
  load();
})();
