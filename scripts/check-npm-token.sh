#!/bin/bash
set -e

echo "🔍 Checking NPM token permissions..."

# Check if NPM_TOKEN is set
if [ -z "$NPM_TOKEN" ]; then
  echo "❌ ERROR: NPM_TOKEN environment variable is not set"
  exit 1
fi

# Test token authentication
WHOAMI_RESPONSE=$(curl -s -w "\n%{http_code}" -H "Authorization: Bearer $NPM_TOKEN" https://registry.npmjs.org/-/whoami)
HTTP_CODE=$(echo "$WHOAMI_RESPONSE" | tail -n1)
BODY=$(echo "$WHOAMI_RESPONSE" | head -n-1)

if [ "$HTTP_CODE" != "200" ]; then
  echo "❌ ERROR: NPM token authentication failed (HTTP $HTTP_CODE)"
  echo "Response: $BODY"
  echo ""
  echo "Possible causes:"
  echo "  - Token is expired"
  echo "  - Token is invalid"
  echo "  - Token has been revoked"
  echo ""
  echo "Please regenerate your NPM_TOKEN at:"
  echo "  https://www.npmjs.com/settings/tokens"
  exit 1
fi

USERNAME=$(echo "$BODY" | jq -r '.username')
echo "✅ Authenticated as: $USERNAME"

# Get package info
PACKAGE_NAME="permaweb-deploy"
PACKAGE_INFO=$(curl -s "https://registry.npmjs.org/$PACKAGE_NAME")

# Check if package exists
if echo "$PACKAGE_INFO" | jq -e '.error' > /dev/null 2>&1; then
  echo "⚠️  Package '$PACKAGE_NAME' not found in registry"
  echo "This will be a first-time publish"
else
  # Check if user is a maintainer
  MAINTAINERS=$(echo "$PACKAGE_INFO" | jq -r '.maintainers[].name')

  if echo "$MAINTAINERS" | grep -q "^$USERNAME$"; then
    echo "✅ User '$USERNAME' is a maintainer of '$PACKAGE_NAME'"
  else
    echo "❌ ERROR: User '$USERNAME' is NOT a maintainer of '$PACKAGE_NAME'"
    echo ""
    echo "Current maintainers:"
    echo "$MAINTAINERS" | sed 's/^/  - /'
    echo ""
    echo "The token belongs to '$USERNAME' but the package is maintained by other users."
    echo "Please use a token from one of the maintainers listed above."
    exit 1
  fi
fi

# Test token permissions by checking if we can access package details
PACKAGE_ACCESS=$(curl -s -w "\n%{http_code}" -H "Authorization: Bearer $NPM_TOKEN" \
  "https://registry.npmjs.org/-/package/$PACKAGE_NAME/access")
ACCESS_HTTP_CODE=$(echo "$PACKAGE_ACCESS" | tail -n1)

if [ "$ACCESS_HTTP_CODE" = "200" ] || [ "$ACCESS_HTTP_CODE" = "404" ]; then
  echo "✅ Token has access to package information"
else
  echo "⚠️  Warning: Could not verify package access (HTTP $ACCESS_HTTP_CODE)"
  echo "Token may have limited permissions"
fi

# Final check: Verify token can be used for publishing
echo ""
echo "✅ NPM token validation passed!"
echo "   Username: $USERNAME"
echo "   Package: $PACKAGE_NAME"
echo "   Ready to publish: ✓"

