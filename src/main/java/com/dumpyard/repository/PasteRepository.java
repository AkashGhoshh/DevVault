package com.dumpyard.repository;

import com.dumpyard.entity.Paste;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface PasteRepository extends JpaRepository<Paste, Long> {
    Optional<Paste> findByOwnerToken(String ownerToken);
    Optional<Paste> findBySuggestToken(String suggestToken);
    Optional<Paste> findByReadToken(String readToken);
}
