export async function readApiResponse(response) {
  const text = await response.text();
  let result;
  try { result = JSON.parse(text); }
  catch {
    throw new Error(response.status >= 500
      ? 'The verification service is temporarily unavailable. Please try again shortly.'
      : 'Unable to reach the verification service. Please reload the page and try again.');
  }
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    throw new Error('The verification service returned an invalid response. Please try again.');
  }
  if (!response.ok) throw new Error(result.error || 'Unable to verify this phone number.');
  return result;
}
