/** Asserts that all the passed entities weren't mutated after executing the passed procedure
 *
 * @param {object[]} entities
 * @param {Function} procedure
 * @returns {Promise<void>}
 */
async function assertNoMutations(entities, procedure) {
    const entitiesBefore = entities.map((entity) => JSON.stringify(entity));

    await procedure();

    entities.forEach((entity, i) => {
        expect(entitiesBefore[i]).toEqual(JSON.stringify(entity));
    });
}

module.exports = {
    assertNoMutations,
};
