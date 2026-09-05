function normalizeText(value) {
    return String(value ?? '')
        .replace(/[’‘]/g, "'")
        .replace(/\s+/g, ' ')
        .trim();
}

const BANNER_PATTERNS = [
    /we can'?t log you in right now/i,
    /your (?:login id|user id) or password.*incorrect/i,
    /the (?:login id|user id) or password.*incorrect/i,
    /invalid (?:login|credentials|user id|password)/i,
    /incorrect (?:login id|user id|password)/i,
    /locked/i,
    /too many failed/i,
    /suspicious/i,
    /credential\/risk rejection|flagged (?:for )?risk/i,
    /(?:2fa|two.factor|verification code).*(?:reject|invalid|fail|denied)/i,
    /(?:invalid|incorrect|rejected).*security code/i,
    /security code.*(?:incorrect|invalid|rejected|expired)/i,
    /enter a valid 6-digit security code/i,
];

const RETRYABLE_ERROR_PATTERNS = [
    /net::ERR_TUNNEL_CONNECTION_FAILED/i,
    /net::ERR_PROXY_CONNECTION_FAILED/i,
    /net::ERR_CONNECTION_REFUSED/i,
];

function looksLikeCredentialOrRiskBanner(value) {
    const text = normalizeText(value);
    return BANNER_PATTERNS.some(pattern => pattern.test(text));
}

function isRetryableWithProxy(value, credentialsNotSubmitted = false) {
    const text = normalizeText(value);
    return credentialsNotSubmitted === true
        && !looksLikeCredentialOrRiskBanner(text)
        && RETRYABLE_ERROR_PATTERNS.some(pattern => pattern.test(text));
}

module.exports = {
    isRetryableWithProxy,
    looksLikeCredentialOrRiskBanner,
    normalizeText,
};
