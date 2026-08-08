/* Quarry Sports Bar — runtime configuration.
   Opened directly from disk (file://): runs in DEMO mode automatically, so you
   can always preview the Play flow by double-clicking play.html.
   On the deployed site (https): talks to the live backend at /api.
   To force demo on the deployed site (e.g. before backend setup), change
   the '/api' below to null. */
window.QUARRY_API = (location.protocol === 'file:') ? null : '/api';
