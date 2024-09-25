const spinner = async (action, options) => {
    // eslint-disable-next-line node/no-unsupported-features/es-syntax
    const { oraPromise } = await import('ora');
    return oraPromise(action, {
        spinner: 'triangle',
        ...options,
    });
};
export default spinner;
