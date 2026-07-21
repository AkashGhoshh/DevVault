package com.dumpyard.repository;

import com.dumpyard.entity.PasteRevision;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PasteRevisionRepository extends JpaRepository<PasteRevision, Long> {
    List<PasteRevision> findByPasteIdOrderBySubmittedAtDesc(Long pasteId);
    List<PasteRevision> findByPasteIdAndStatusOrderBySubmittedAtDesc(Long pasteId, PasteRevision.RevisionStatus status);
}
