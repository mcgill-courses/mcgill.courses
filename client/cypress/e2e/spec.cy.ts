/// <reference types="cypress" />
describe('All', () => {
  beforeEach(() => {
    cy.intercept('GET', '**/user', { fixture: 'user.json' });
    cy.visit('/');
  });

  it('Should visit the root', () => {
    cy.contains(
      'Explore thousands of course and professor reviews from McGill students'
    );
  });
});
