// frontend/public/js/routes.js
import * as Home from './views/home.js';
import * as Production from './views/production.js';
import * as Maintenance from './views/maintenance.js';
import * as Admin from './views/admin.js';
import * as OEE from './views/oee.js';

export const routes = {
  home: {
    mount: Home.homeMount,
    unmount: Home.homeUnmount
  },

  production: {
    history: {
      view: Production.productionHistoryView,
      mount: Production.productionHistoryMount,
      unmount: Production.productionHistoryUnmount
    },
    press: {
      view: Production.productionPressView
    },
    heat: {
      view: Production.productionHeatView
    },
    lathe: {
      view: Production.productionLatheView
    }
  },

  maintenance: {
    overview: {
      plant1: { view: Maintenance.plant1View },
      plant2: { view: Maintenance.plant2View }
    },
    request: { view: Maintenance.requestView },
    report: { view: Maintenance.reportView }
  },

  oee: {
    view: OEE.oeeView
  },  

  admin: {
    alarm: {
      view: Admin.adminAlarmView,
      mount: Admin.adminAlarmMount,
      unmount: Admin.adminAlarmUnmount,
      role: 'admin'
    },
    database: {
      view: Admin.adminDatabaseView,
      role: 'admin'
    }
  }

};
