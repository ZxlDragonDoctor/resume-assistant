package com.zxl.resume.resume.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.zxl.resume.resume.dto.SaveResumeContentRequest;
import com.zxl.resume.resume.entity.*;
import com.zxl.resume.resume.repository.*;
import org.h2.jdbcx.JdbcDataSource;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.aop.framework.ProxyFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.transaction.annotation.AnnotationTransactionAttributeSource;
import org.springframework.transaction.interceptor.TransactionInterceptor;
import org.springframework.web.server.ResponseStatusException;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** Exercises real Spring transactions and row locks using JDBC-backed mapper doubles.
 * PostgreSQL JSONB mapper compatibility requires the application's PostgreSQL environment. */
class ManualSaveTransactionTest {
    final ResumeMapper resumes = mock(ResumeMapper.class);
    final SectionMapper sections = mock(SectionMapper.class);
    final ResumeVersionMapper versions = mock(ResumeVersionMapper.class);
    final UUID id = UUID.randomUUID(), owner = UUID.randomUUID(), sectionId = UUID.randomUUID();
    final Instant initial = Instant.parse("2026-01-01T00:00:00Z");
    final ObjectMapper json = new ObjectMapper().findAndRegisterModules();
    JdbcTemplate db;
    ResumeService service;

    @BeforeEach void setup() {
        JdbcDataSource source = new JdbcDataSource();
        source.setURL("jdbc:h2:mem:" + UUID.randomUUID() + ";DB_CLOSE_DELAY=-1;LOCK_TIMEOUT=5000");
        db = new JdbcTemplate(source);
        db.execute("CREATE TABLE resumes(id UUID PRIMARY KEY, title VARCHAR(200), updated_at TIMESTAMP)");
        db.execute("CREATE TABLE sections(id UUID PRIMARY KEY, data VARCHAR)");
        db.execute("CREATE TABLE versions(id UUID PRIMARY KEY, number INT UNIQUE, snapshot VARCHAR)");
        db.update("INSERT INTO resumes VALUES(?,?,?)", id, "Before", Timestamp.from(initial));
        db.update("INSERT INTO sections VALUES(?,?)", sectionId, "{\"content\":\"before\"}");
        when(resumes.findByIdForUpdate(id)).thenAnswer(call -> readResume(true));
        when(resumes.selectById(id)).thenAnswer(call -> readResume(false));
        when(resumes.replaceContent(any())).thenAnswer(call -> {
            Resume resume = call.getArgument(0);
            return db.update("UPDATE resumes SET title=?,updated_at=? WHERE id=?", resume.getTitle(), Timestamp.from(Instant.now()), id);
        });
        when(sections.findByResumeIdOrdered(id)).thenAnswer(call -> db.query("SELECT * FROM sections", (row, n) -> {
            var s = new ResumeSection(); s.setId(row.getObject("id", UUID.class)); s.setResumeId(id);
            s.setSectionType("summary"); s.setSortOrder(0); s.setLayout("single-column"); s.setIsVisible(true);
            s.setData(row.getString("data")); return s;
        }));
        doAnswer(call -> { db.update("DELETE FROM sections"); return null; }).when(sections).deleteByResumeId(id);
        when(versions.findByResumeId(id)).thenAnswer(call -> db.query("SELECT * FROM versions ORDER BY number DESC", (row, n) -> {
            var v = new ResumeVersion(); v.setId(row.getObject("id", UUID.class)); v.setResumeId(id);
            v.setVersionNum(row.getInt("number")); v.setSnapshot(row.getString("snapshot")); return v;
        }));
        when(versions.insert(any(ResumeVersion.class))).thenAnswer(call -> {
            ResumeVersion v = call.getArgument(0);
            return db.update("INSERT INTO versions VALUES(?,?,?)", v.getId(), v.getVersionNum(), v.getSnapshot());
        });
        ResumeService target = new ResumeService(resumes, sections, versions, mock(TemplateCategoryMapper.class), json);
        ProxyFactory proxy = new ProxyFactory(target);
        proxy.setProxyTargetClass(true);
        proxy.addAdvice(new TransactionInterceptor(new DataSourceTransactionManager(source), new AnnotationTransactionAttributeSource()));
        service = (ResumeService) proxy.getProxy();
    }

    Resume readResume(boolean lock) {
        return db.queryForObject("SELECT * FROM resumes WHERE id=?" + (lock ? " FOR UPDATE" : ""), (row, n) -> {
            Resume r = new Resume(); r.setId(id); r.setUserId(owner); r.setTitle(row.getString("title"));
            r.setUpdatedAt(row.getTimestamp("updated_at").toInstant()); return r;
        }, id);
    }

    SaveResumeContentRequest request() throws Exception {
        return json.readValue("""
            {"title":"After","fontFamily":"system-ui","fontSize":14,"themeColor":"#123456",
             "lineSpacing":1.5,"layoutConfig":"{}","sections":[],"expectedUpdatedAt":"2026-01-01T00:00:00Z"}
            """, SaveResumeContentRequest.class);
    }

    @Test void failedResultSnapshotRollsBackMetadataSectionsAndBaseline() throws Exception {
        AtomicInteger count = new AtomicInteger();
        when(versions.insert(any(ResumeVersion.class))).thenAnswer(call -> {
            ResumeVersion v = call.getArgument(0);
            db.update("INSERT INTO versions VALUES(?,?,?)", v.getId(), v.getVersionNum(), v.getSnapshot());
            if (count.incrementAndGet() == 2) throw new IllegalStateException("simulated failure after writes");
            return 1;
        });
        var req = request();
        assertThrows(IllegalStateException.class, () -> service.saveContent(id, owner, req));
        assertEquals("Before", readResume(false).getTitle());
        assertEquals(initial, readResume(false).getUpdatedAt());
        assertEquals(1, db.queryForObject("SELECT COUNT(*) FROM sections", Integer.class));
        assertEquals(0, db.queryForObject("SELECT COUNT(*) FROM versions", Integer.class));
    }

    @Test void competingSavesSerializeAndRejectStaleSecondWriter() throws Exception {
        CountDownLatch firstLocked = new CountDownLatch(1), releaseFirst = new CountDownLatch(1), secondLockAttempt = new CountDownLatch(1);
        AtomicInteger lockCalls = new AtomicInteger();
        when(resumes.findByIdForUpdate(id)).thenAnswer(call -> {
            if (lockCalls.incrementAndGet() == 2) secondLockAttempt.countDown();
            return readResume(true);
        });
        doAnswer(call -> {
            firstLocked.countDown();
            assertTrue(releaseFirst.await(5, TimeUnit.SECONDS));
            db.update("DELETE FROM sections"); return null;
        }).when(sections).deleteByResumeId(id);
        var firstRequest = request(); var secondRequest = request(); secondRequest.setTitle("Conflicting");
        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            Future<?> first = pool.submit(() -> service.saveContent(id, owner, firstRequest));
            assertTrue(firstLocked.await(5, TimeUnit.SECONDS));
            Future<?> second = pool.submit(() -> service.saveContent(id, owner, secondRequest));
            assertTrue(secondLockAttempt.await(5, TimeUnit.SECONDS));
            assertFalse(second.isDone());
            releaseFirst.countDown();
            first.get(10, TimeUnit.SECONDS);
            ExecutionException failure = assertThrows(ExecutionException.class, () -> second.get(10, TimeUnit.SECONDS));
            assertInstanceOf(ResponseStatusException.class, failure.getCause());
            assertEquals(409, ((ResponseStatusException) failure.getCause()).getStatusCode().value());
            assertEquals("After", readResume(false).getTitle());
            assertEquals(2, db.queryForObject("SELECT COUNT(*) FROM versions", Integer.class));
        } finally { releaseFirst.countDown(); pool.shutdownNow(); }
    }
}
