import routes from './routes.json';

describe('routes.json', () => {
  it('keeps the old admission routes only as legacy redirects', () => {
    expect(routes.pages).toEqual([
      {
        component: 'legacyAdmissionRedirect',
        route: 'admission',
        online: true,
        offline: false,
      },
      {
        component: 'legacyAdmissionRedirect',
        route: 'home/admission',
        online: true,
        offline: false,
      },
    ]);
  });

  it('registers navigation entry points for care logbook workflows', () => {
    expect(routes.extensions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          component: 'careLogbookAppMenuLink',
          name: 'care-logbook-app-menu-item',
          slot: 'app-menu-slot',
        }),
        expect.objectContaining({
          component: 'careLogbookMergeAppMenuItem',
          name: 'care-logbook-merge-app-menu-item',
          slot: 'app-menu-item-slot',
          privileges: ['app:home.libroAtenciones', 'app:home.libroAtenciones.editar', 'app:opciones.fusionarPacientes'],
          online: true,
          offline: false,
          order: 100,
        }),
        expect.objectContaining({
          component: 'careLogbookHomeDashboardLink',
          name: 'care-logbook-home-dashboard-link',
          slot: 'homepage-dashboard-slot',
          meta: expect.objectContaining({
            name: 'care-logbook',
            slot: 'care-logbook-dashboard-slot',
          }),
        }),
        expect.objectContaining({
          component: 'careLogbookLegacyHomeDashboardAlias',
          name: 'care-logbook-legacy-home-dashboard-alias',
          slot: 'homepage-dashboard-slot',
          meta: expect.objectContaining({
            name: 'admission',
            slot: 'care-logbook-dashboard-slot',
            path: '/home/care-logbook',
          }),
        }),
        expect.objectContaining({
          component: 'careLogbookMergePatientsMenuItem',
          name: 'care-logbook-merge-patients-menu-item',
          slot: 'patient-actions-slot',
          privileges: ['app:home.libroAtenciones.editar', 'app:opciones.fusionarPacientes'],
          order: 9,
        }),
      ]),
    );

    expect(routes.extensions).toContainEqual(
      expect.objectContaining({
        component: 'careLogbookHomeDashboard',
        slot: 'care-logbook-dashboard-slot',
      }),
    );
    expect(routes.extensions).not.toContainEqual(expect.objectContaining({ slot: 'top-nav-actions-slot' }));
  });

  it('does not register patient banner identity extensions from the care logbook', () => {
    expect(routes.extensions).not.toContainEqual(
      expect.objectContaining({
        slot: 'patient-info-slot',
      }),
    );
  });
});
