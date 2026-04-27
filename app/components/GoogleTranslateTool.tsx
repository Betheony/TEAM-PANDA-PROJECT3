"use client";

/*
  URL to sent API requests to.
  THIS NEEDS TO BE CHANGED ON DEPLOYMENT!!
*/
// const api_url = "http://localhost:3000/api/translate";
const api_url = "https://panda33boba.vercel.app/api/translate";

/*
  Translates one string into Spanish.

  Important design choice:
  If translation fails, this returns the original English text instead of an
  error message. This prevents the UI from showing "Could not translate..."
  everywhere if the API fails.
*/
export async function translate_text(text_to_translate: string): Promise<string> {
  if (!text_to_translate?.trim()) {
    return text_to_translate;
  }

  try {
    const res = await fetch(api_url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: text_to_translate,
        target: "es",
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("Translation failed:", data);
      return text_to_translate;
    }

    return data.translatedText ?? text_to_translate;
  } catch (error) {
    console.error("Translation request error:", error);
    return text_to_translate;
  }
}

/*
  Translates every value inside an object.

  Example:
  {
    place_order: "place order",
    cart_is_empty: "cart is empty"
  }

  becomes:
  {
    place_order: "realizar pedido",
    cart_is_empty: "el carrito está vacío"
  }

  Why this exists:
  Static UI text is stored in objects, so this lets us translate the whole object
  without manually translating each field one by one.
*/
export async function translate_struct_text<T extends Record<string, string>>(
  text_English: T
): Promise<T> {
  const translatedEntries = await Promise.all(
    Object.entries(text_English).map(async ([key, value]) => {
      const translated = await translate_text(value);
      return [key, translated];
    })
  );

  return Object.fromEntries(translatedEntries) as T;
}