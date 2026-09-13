/**
 * DutyRoster — termly teacher-on-duty roster.
 *
 * The school sets how many teachers are on duty each week and how many weeks
 * the term runs; the generator in utils/dutyRoster.js deals the teachers out
 * evenly and this view publishes the result.
 *
 * STORAGE: the config and the generated roster are saved onto
 * `settings.dutyRoster` via updateSettings — the same pattern the timetable
 * config uses. No migration needed, and it is immediately available to every
 * portal that reads settings.
 *
 * PUBLISHING alerts teaching staff through `notifications` with audience
 * ['teachers'], the bucket Notices.jsx maps the teacher role onto.
 */

import { useMemo, useState, useEffect } from 'react';
import { upsertRow } from '../lib/api';
import { exportTablePDF } from '../utils/exporters';
import {
  generateDutyRoster, rosterToRows, currentDutyWeek, DEFAULT_ROSTER_CONFIG,
} from '../utils/dutyRoster';
import {
  CalendarDays, Users, RefreshCw, Download, Megaphone, ShieldCheck, AlertTriangle,
} from 'lucide-react';
import {
  SneatPage, Grid, Card, CardHead, CardBody, MetricCard, Spotlight,
  TableCard, RankList, SnBadge, SnButton, SnEmpty, SNEAT,
} from '../components/sneat';

/** Roles allowed to generate and publish a roster. */
const CAN_PUBLISH = ['principal', 'deputy_academic', 'deputy_admin', 'dos'];

export default function DutyRoster({ store, user }) {
  const { settings = {}, teachers = [], notify, updateSettings } = store || {};
  const role = String(user?.role || store?.role || '').toLowerCase();
  const canPublish = CAN_PUBLISH.includes(role);

  const saved = settings?.dutyRoster || {};
  const [config, setConfig] = useState({ ...DEFAULT_ROSTER_CONFIG, ...(saved.config || {}) });
  const [roster, setRoster] = useState(saved.roster || null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (saved.roster && !roster) setRoster(saved.roster);
  }, [saved.roster]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeTeachers = useMemo(
    () => (teachers || []).filter((t) => t.status !== 'Inactive' && t.name),
    [teachers]
  );

  const up = (patch) => { setConfig((c) => ({ ...c, ...patch })); setDirty(true); };

  const toggleExcluded = (name) => {
    setConfig((c) => {
      const ex = new Set(c.excluded || []);
      if (ex.has(name)) ex.delete(name); else ex.add(name);
      return { ...c, excluded: [...ex] };
    });
    setDirty(true);
  };

  const preview = useMemo(
    () => generateDutyRoster(activeTeachers, config),
    [activeTeachers, config]
  );

  const shown = dirty || !roster ? preview : roster;
  const thisWeek = currentDutyWeek(shown);

  const save = async () => {
    const next = { config, roster: preview, generatedAt: new Date().toISOString() };
    try {
      await updateSettings?.({ dutyRoster: next });
      setRoster(preview);
      setDirty(false);
      notify?.('Duty roster saved', 'success', 'Duty Roster');
    } catch (e) {
      notify?.(`Could not save the roster: ${e.message}`, 'error');
    }
  };

  const publish = async () => {
    if (!canPublish) return notify?.('Only the principal, a deputy or the DoS can publish a roster.', 'error');
    if (!preview.weeks.length) return notify?.('Generate a roster first.', 'warning');
    await save();
    const first = preview.weeks[0];
    try {
      await upsertRow('notifications', {
        id: `duty_${Date.now()}`,
        title: `Teacher duty roster — ${config.weeks} weeks`,
        message: `The termly duty roster is published. Week 1: ${first.teachers.map((t) => t.name).join(', ')}.`,
        body:
          `The teacher-on-duty roster for this term has been published.\n\n` +
          preview.weeks
            .map((w) => `Week ${w.week}${w.start ? ` (${w.start} → ${w.end})` : ''}: ${w.teachers.map((t) => t.name).join(', ')}`)
            .join('\n'),
        posted_by: user?.name || 'Administration',
        role,
        audience: ['teachers'],
        read: false,
        created_at: new Date().toISOString(),
      });
      notify?.('Roster published — all teaching staff alerted', 'success', 'Duty Roster');
    } catch (e) {
      notify?.(`Roster saved but the alert failed: ${e.message}`, 'warning');
    }
  };

  const exportPdf = () => {
    if (!shown.weeks?.length) return notify?.('Nothing to export yet.', 'warning');
    exportTablePDF({
      school: settings,
      title: 'TEACHER ON DUTY — TERMLY ROSTER',
      subtitle: `${config.weeks} weeks · ${config.teachersPerWeek} teacher(s) per week`,
      head: ['Week', 'Dates', 'Teachers on duty'],
      body: rosterToRows(shown).map((r) => [r.week, r.dates, r.teachers]),
      filename: `Duty_Roster_${new Date().toISOString().slice(0, 10)}.pdf`,
    });
  };

  const loads = Object.entries(shown.counts || {}).sort((a, b) => b[1] - a[1]);
  const maxLoad = loads.length ? loads[0][1] : 0;

  return (
    <SneatPage
      flush
      title="Teacher on duty"
      subtitle="Generate and publish the termly duty roster"
      actions={
        <>
          <SnButton variant="outline" onClick={exportPdf}><Download size={15} /> Export PDF</SnButton>
          {canPublish && (
            <>
              <SnButton variant="outline" onClick={save} disabled={!dirty}>
                <RefreshCw size={15} /> {dirty ? 'Save roster' : 'Saved'}
              </SnButton>
              <SnButton variant="primary" onClick={publish}>
                <Megaphone size={15} /> Publish & alert staff
              </SnButton>
            </>
          )}
        </>
      }
    >
      <Spotlight
        icon={<ShieldCheck size={13} />}
        eyebrow="On duty this week"
        value={thisWeek ? thisWeek.teachers.map((t) => t.name).join(', ') : '—'}
        meta={thisWeek ? `Week ${thisWeek.week} of ${shown.weeks.length}` : 'Outside the rostered term'}
        caption={
          shown.weeks?.length
            ? `${config.teachersPerWeek} teacher${config.teachersPerWeek === 1 ? '' : 's'} on duty per week across ` +
              `${config.weeks} week${config.weeks === 1 ? '' : 's'}, drawn from ${activeTeachers.length - (config.excluded?.length || 0)} available teachers.`
            : 'No roster generated yet. Set the options below and it builds automatically.'
        }
        stats={[
          { label: 'Weeks', value: shown.weeks?.length || 0 },
          { label: 'Per week', value: config.teachersPerWeek },
          { label: 'In rotation', value: Object.keys(shown.counts || {}).length },
        ]}
      />

      {shown.warnings?.length > 0 && (
        <Card>
          <CardBody style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <span className="sn-icon sn-icon-warning"><AlertTriangle /></span>
            <div>
              {shown.warnings.map((w) => (
                <p key={w} style={{ margin: '2px 0', fontSize: 13, color: SNEAT.body }}>{w}</p>
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      <Grid cols="4-8">
        <Card>
          <CardHead title="Roster settings" subtitle="Changes regenerate instantly" />
          <CardBody>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label className="field-label">Teachers on duty per week</label>
                <input
                  className="input" type="number" min="1" max="10"
                  value={config.teachersPerWeek}
                  onChange={(e) => up({ teachersPerWeek: Number(e.target.value) })}
                  disabled={!canPublish}
                />
              </div>
              <div>
                <label className="field-label">Number of weeks in the term</label>
                <input
                  className="input" type="number" min="1" max="20"
                  value={config.weeks}
                  onChange={(e) => up({ weeks: Number(e.target.value) })}
                  disabled={!canPublish}
                />
              </div>
              <div>
                <label className="field-label">Term starts (Monday of week 1)</label>
                <input
                  className="input" type="date"
                  value={config.startDate || ''}
                  onChange={(e) => up({ startDate: e.target.value })}
                  disabled={!canPublish}
                />
              </div>

              <div>
                <label className="field-label">Exclude from rotation</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                  {activeTeachers.length === 0 && (
                    <span className="sn-muted" style={{ fontSize: 12 }}>No teachers on record.</span>
                  )}
                  {activeTeachers.map((t) => {
                    const off = (config.excluded || []).includes(t.name);
                    return (
                      <button
                        key={t.id || t.name}
                        onClick={() => canPublish && toggleExcluded(t.name)}
                        className={`sn-badge sn-badge-${off ? 'danger' : 'secondary'}`}
                        style={{ border: 'none', cursor: canPublish ? 'pointer' : 'default', fontFamily: 'inherit' }}
                        title={off ? 'Excluded — click to include' : 'Click to exclude'}
                      >
                        {t.name}{off ? ' ✕' : ''}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </CardBody>
        </Card>

        <TableCard
          title="Termly roster"
          subtitle={config.startDate ? 'Week commencing dates shown' : 'Set a start date to show dates'}
          rows={shown.weeks || []}
          rowKey={(w) => w.week}
          empty={<SnEmpty icon={<CalendarDays />} title="No roster yet"
            message="Set the teachers per week and the number of weeks." />}
          columns={[
            {
              key: 'week', header: 'Week',
              render: (w) => (
                <span className="sn-td-strong">
                  Week {w.week}{thisWeek?.week === w.week ? ' ' : ''}
                  {thisWeek?.week === w.week && <SnBadge tone="success">now</SnBadge>}
                </span>
              ),
            },
            { key: 'dates', header: 'Dates', render: (w) => (w.start ? `${w.start} → ${w.end}` : '—') },
            {
              key: 'teachers', header: 'On duty',
              render: (w) => (
                <span style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap' }}>
                  {w.teachers.map((t) => <SnBadge key={t.name} tone="primary">{t.name}</SnBadge>)}
                </span>
              ),
            },
          ]}
        />
      </Grid>

      <Grid cols="8-4">
        <Card>
          <CardHead title="Duty load" subtitle="Weeks on duty per teacher — should be within one of each other" />
          <CardBody>
            <RankList
              empty={<SnEmpty icon={<Users />} title="No rotation yet" />}
              items={loads.map(([name, n]) => ({
                id: name,
                title: name,
                sub: `${n} week${n === 1 ? '' : 's'} on duty`,
                value: String(n),
                icon: <Users />,
                tone: 'primary',
                progress: maxLoad ? (n / maxLoad) * 100 : 0,
              }))}
            />
          </CardBody>
        </Card>

        <Grid cols={1}>
          <MetricCard label="Weeks rostered" value={shown.weeks?.length || 0} icon={<CalendarDays />} tone="primary" />
          <MetricCard label="Teachers in rotation" value={Object.keys(shown.counts || {}).length}
            icon={<Users />} tone="info" foot={`${config.excluded?.length || 0} excluded`} />
        </Grid>
      </Grid>
    </SneatPage>
  );
}
