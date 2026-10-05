export type ImageConfig = {
  baseURL: string;
  apiKey: string;
  model: string;
  format: "openai";
};

export const imageSettings: Omit<ImageConfig, "apiKey"> = {
  baseURL: "https://ai.gateway.lovable.dev",
  model: "openai/gpt-image-2.5-sunburst",
  format: "openai",
};

export async function editImage(config: ImageConfig, form: FormData) {
  const streaming = form.get("stream") !== "false";
  form.set("model", config.model);
  form.set("quality", "medium");
  form.set("size", "1024x1536");
  if (streaming) {
    form.set("stream", "true");
    form.set("partial_images", "1");
  } else {
    form.delete("stream");
    form.delete("partial_images");
  }

  return fetch(`${config.baseURL}/v1/images/edits`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Lovable-API-Key": config.apiKey,
    },
    body: form,
  });
}
