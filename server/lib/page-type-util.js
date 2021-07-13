const PageTypes = {
    PAGE: 'PAGE',
    PRODUCT: 'PRODUCT',
    CATEGORY: 'CATEGORY',
    BRAND: 'BRAND',
    ACCOUNT_RETURN_SAVED: 'ACCOUNT_RETURN_SAVED',
    ACCOUNT_ADD_RETURN: 'ACCOUNT_ADD_RETURN',
    ACCOUNT_RETURNS: 'ACCOUNT_RETURNS',
    ACCOUNT_ADD_ADDRESS: 'ACCOUNT_ADD_ADDRESS',
    ACCOUNT_ADD_WISHLIST: 'ACCOUNT_ADD_WISHLIST',
    ACCOUNT_WISHLISTS: 'ACCOUNT_WISHLISTS',
    ACCOUNT_WISHLIST_DETAILS: 'ACCOUNT_WISHLIST_DETAILS',
    ACCOUNT_EDIT: 'ACCOUNT_EDIT',
    ACCOUNT_ADDRESS: 'ACCOUNT_ADDRESS',
    ACCOUNT_INBOX: 'ACCOUNT_INBOX',
    ACCOUNT_DOWNLOAD_ITEM: 'ACCOUNT_DOWNLOAD_ITEM',
    ACCOUNT_ORDERS_ALL: 'ACCOUNT_ORDERS_ALL',
    ACCOUNT_ORDERS_INVOICE: 'ACCOUNT_ORDERS_INVOICE',
    ACCOUNT_ORDERS_DETAILS: 'ACCOUNT_ORDERS_DETAILS',
    ACCOUNT_ORDERS_COMPLETED: 'ACCOUNT_ORDERS_COMPLETED',
    ACCOUNT_RECENT_ITEMS: 'ACCOUNT_RECENT_ITEMS',
    AUTH_ACCOUNT_CREATED: 'AUTH_ACCOUNT_CREATED',
    AUTH_LOGIN: 'AUTH_LOGIN',
    AUTH_CREATE_ACC: 'AUTH_CREATE_ACC',
    AUTH_FORGOT_PASS: 'AUTH_FORGOT_PASS',
    AUTH_NEW_PASS: 'AUTH_NEW_PASS',
    BLOG_POST: 'BLOG_POST',
    BLOG: 'BLOG',
    BRANDS: 'BRANDS',
    CART: 'CART',
    COMPARE: 'COMPARE',
    CONTACT_US: 'CONTACT_US',
    HOME: 'HOME',
    GIFT_CERT_PURCHASE: 'GIFT_CERT_PURCHASE',
    GIFT_CERT_REDEEM: 'GIFT_CERT_REDEEM',
    GIFT_CERT_BALANCE: 'GIFT_CERT_BALANCE',
    ORDER_INFO: 'ORDER_INFO',
    SEARCH: 'SEARCH',
    SITEMAP: 'SITEMAP',
    SUBSCRIBED: 'SUBSCRIBED',
    UNSUBSCRIBE: 'UNSUBSCRIBE',
};

const templateFileToPageTypeMap = {
    'pages/page': PageTypes.PAGE,
    'pages/product': PageTypes.PRODUCT,
    'pages/category': PageTypes.CATEGORY,
    'pages/brand': PageTypes.BRAND,
    'pages/account/return-saved': PageTypes.ACCOUNT_RETURN_SAVED,
    'pages/account/add-return': PageTypes.ACCOUNT_ADD_RETURN,
    'pages/account/returns': PageTypes.ACCOUNT_RETURNS,
    'pages/account/add-address': PageTypes.ACCOUNT_ADD_ADDRESS,
    'pages/account/add-wishlist': PageTypes.ACCOUNT_ADD_WISHLIST,
    'pages/account/wishlists': PageTypes.ACCOUNT_WISHLISTS,
    'pages/account/wishlist-details': PageTypes.ACCOUNT_WISHLIST_DETAILS,
    'pages/account/edit': PageTypes.ACCOUNT_EDIT,
    'pages/account/addresses': PageTypes.ACCOUNT_ADDRESS,
    'pages/account/inbox': PageTypes.ACCOUNT_INBOX,
    'pages/account/download-item': PageTypes.ACCOUNT_DOWNLOAD_ITEM,
    'pages/account/orders/all': PageTypes.ACCOUNT_ORDERS_ALL,
    'pages/account/orders/invoice': PageTypes.ACCOUNT_ORDERS_INVOICE,
    'pages/account/orders/details': PageTypes.ACCOUNT_ORDERS_DETAILS,
    'pages/account/orders/completed': PageTypes.ACCOUNT_ORDERS_COMPLETED,
    'pages/account/recent-items': PageTypes.ACCOUNT_RECENT_ITEMS,
    'pages/auth/account-created': PageTypes.AUTH_ACCOUNT_CREATED,
    'pages/auth/login': PageTypes.AUTH_LOGIN,
    'pages/auth/create-account': PageTypes.AUTH_CREATE_ACC,
    'pages/auth/forgot-password': PageTypes.AUTH_FORGOT_PASS,
    'pages/auth/new-password': PageTypes.AUTH_NEW_PASS,
    'pages/blog-post': PageTypes.BLOG_POST,
    'pages/blog': PageTypes.BLOG,
    'pages/brands': PageTypes.BRANDS,
    'pages/cart': PageTypes.CART,
    'pages/compare': PageTypes.COMPARE,
    'pages/contact-us': PageTypes.CONTACT_US,
    'pages/home': PageTypes.HOME,
    'pages/gift-certificate/purchase': PageTypes.GIFT_CERT_PURCHASE,
    'pages/gift-certificate/redeem': PageTypes.GIFT_CERT_REDEEM,
    'pages/gift-certificate/balance': PageTypes.GIFT_CERT_BALANCE,
    'pages/order-confirmation': PageTypes.ORDER_INFO,
    'pages/search': PageTypes.SEARCH,
    'pages/sitemap': PageTypes.SITEMAP,
    'pages/subscribed': PageTypes.SUBSCRIBED,
    'pages/unsubscribe': PageTypes.UNSUBSCRIBE,
};

/**
 * Convert a templateFile to pageType
 *
 * @param {string} templateFile
 * @returns {string | null}
 */
function getPageType(templateFile) {
    const pageType = templateFileToPageTypeMap[templateFile];

    return pageType;
}

module.exports = {
    getPageType,
};
