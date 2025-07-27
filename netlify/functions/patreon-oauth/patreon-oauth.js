exports.handler = async (event, context) => {
  // Allow CORS requests from any origin
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST',
  };

  if (event.httpMethod === 'OPTIONS') {
    // Handle CORS preflight requests
    return {
      statusCode: 200,
      headers,
      body: 'CORS Preflight',
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: 'Method Not Allowed',
    };
  }

  // Extract the authorization code from the request body
  const { code, refresh_token } = JSON.parse(event.body);

  if (!code && !refresh_token) {
    return {
      statusCode: 400,
      headers,
      body: 'Authorization code or refresh_token is required',
    };
  }

  const client_id = 'DCmpYjAt5oF-1poN2N_hW22VXTuz8BNIOPk1yeoctffuvobAJCu8I7N7fKc1ngMp';
  const redirect_uri = 'https://benis-boy.github.io/library/'; // Make sure this matches the one registered in Patreon

  const token_url = 'https://www.patreon.com/api/oauth2/token?';

  const secret = process.env.NETLIFY_SECRET_PASSWORD;
  const wtdrSecret = process.env.WTDR_SECRET_PASSWORD;
  const encryption_password = secret;
  const encryption_passwordv2 = {
    WtDR: 'NOT_ALLOWED',
  };

  try {
    // Send a POST request to exchange the authorization code for an access token
    let response = null;
    if (code) {
      response = await fetch(
        token_url +
          new URLSearchParams({
            code,
            grant_type: 'authorization_code',
            client_id,
            redirect_uri,
          }).toString(),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );
    } else if (refresh_token) {
      response = await fetch(
        token_url +
          new URLSearchParams({
            grant_type: 'refresh_token',
            client_id,
            refresh_token,
            redirect_uri, // This may not be needed depending on the provider
          }).toString(),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );
    }

    const token = await response.json();

    if (response.ok) {
      const userFetchUrl =
        'https://www.patreon.com/api/oauth2/v2/identity?' +
        new URLSearchParams({
          include: 'memberships.currently_entitled_tiers,memberships.campaign',
          'fields[user]': 'full_name,vanity',
          'fields[member]': 'currently_entitled_amount_cents,lifetime_support_cents,patron_status,pledge_cadence',
        }).toString();

      const userDataResponse = await fetch(userFetchUrl, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token.access_token}`,
          'Content-Type': 'application/json',
        },
      });
      if (!userDataResponse.ok) {
        throw new Error('Failed to fetch user info from Patreon: ' + (await userDataResponse.text()));
      }
      const userInfo = await userDataResponse.json();

      const userName = userInfo.data.attributes.vanity ?? userInfo.data.attributes.full_name ?? 'CouldNotFindName';
      const generalMemberData = userInfo.included.filter((something) => something.type === 'member');
      const myMemberData = generalMemberData.find(
        (memberInfo) => memberInfo?.relationships?.campaign?.data?.id === '12346885'
      );

      const everPaidAnything =
        (myMemberData?.lifetime_support_cents ?? myMemberData?.attributes?.lifetime_support_cents) > 0;
      const isAugust = new Date().getFullYear() === 2025 && new Date().getMonth() === 7;

      const filteredMembershipData = {
        userName,
        supportsMe:
          myMemberData?.attributes?.patron_status === 'active_patron' ||
          userName === 'BenisBoy16' ||
          (everPaidAnything && isAugust),
        currently_entitled_tiers: myMemberData?.relationships?.currently_entitled_tiers,
      };

      if (filteredMembershipData.supportsMe) {
        encryption_passwordv2.WtDR = wtdrSecret;
      }

      // Return the access token to the frontend
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          ...token,
          userInfo: filteredMembershipData,
          membershipData: myMemberData,
          encryption_password,
          encryption_passwordv2,
        }),
      };
    } else {
      // Handle errors from Patreon API
      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify(token),
      };
    }
  } catch (error) {
    // Handle network or other errors
    return {
      statusCode: 500,
      headers,
      body: 'Error fetching token from Patreon: ' + error.message,
    };
  }
};
