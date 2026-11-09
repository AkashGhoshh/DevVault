package com.dumpyard.service;

import com.dumpyard.dto.CreatePasteRequest;
import com.dumpyard.dto.PasteResponse;
import com.dumpyard.dto.UpdatePasteRequest;
import com.dumpyard.entity.Paste;
import com.dumpyard.exception.PasteNotFoundException;
import com.dumpyard.repository.PasteRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PasteServiceTest {

    @Mock
    private PasteRepository pasteRepository;

    @InjectMocks
    private PasteServiceImpl pasteService;

    private Paste paste;

    @BeforeEach
    void setUp() {
        paste = new Paste();
        paste.setId(1L);
        paste.setTitle("Sample Note");
        paste.setContent("Hello World");
        paste.setTags("architecture,api");
        paste.setIsPinned(true);
        paste.setFolder("Architecture");
        paste.setCreatedAt(LocalDateTime.now());
        paste.setUpdatedAt(LocalDateTime.now());
    }

    @Test
    void testCreatePaste_Success() {
        when(pasteRepository.save(any(Paste.class))).thenReturn(paste);

        PasteResponse response = pasteService.createPaste(new CreatePasteRequest("Sample Note", "Hello World"));

        assertNotNull(response);
        assertEquals(1L, response.id());
        assertEquals("Sample Note", response.title());
        assertEquals("Hello World", response.content());
        verify(pasteRepository, times(1)).save(any(Paste.class));
    }

    @Test
    void testGetPaste_Found() {
        when(pasteRepository.findById(1L)).thenReturn(Optional.of(paste));

        PasteResponse response = pasteService.getPaste(1L);

        assertNotNull(response);
        assertEquals(1L, response.id());
        assertEquals("Sample Note", response.title());
    }

    @Test
    void testGetPaste_NotFound() {
        when(pasteRepository.findById(999L)).thenReturn(Optional.empty());

        assertThrows(PasteNotFoundException.class, () -> pasteService.getPaste(999L));
    }

    @Test
    void testGetAllPastes() {
        when(pasteRepository.findAll()).thenReturn(List.of(paste));

        List<PasteResponse> all = pasteService.getAllPastes();

        assertEquals(1, all.size());
        assertEquals("Sample Note", all.get(0).title());
    }

    @Test
    void testUpdatePaste_Success() {
        when(pasteRepository.findById(1L)).thenReturn(Optional.of(paste));
        when(pasteRepository.save(any(Paste.class))).thenReturn(paste);

        PasteResponse response = pasteService.updatePaste(1L, new UpdatePasteRequest("Updated Title", "New Content"));

        assertNotNull(response);
        verify(pasteRepository, times(1)).save(paste);
    }

    @Test
    void testDeletePaste_Success() {
        when(pasteRepository.existsById(1L)).thenReturn(true);

        pasteService.deletePaste(1L);

        verify(pasteRepository, times(1)).deleteById(1L);
    }

    @Test
    void testDeletePaste_NotFound() {
        when(pasteRepository.existsById(999L)).thenReturn(false);

        assertThrows(PasteNotFoundException.class, () -> pasteService.deletePaste(999L));
    }

    @Test
    void testCreatePaste_WithTagsAndPin() {
        when(pasteRepository.save(any(Paste.class))).thenReturn(paste);

        PasteResponse response = pasteService.createPaste(new CreatePasteRequest("Sample Note", "Hello World", "architecture,api", true, "Architecture"));

        assertNotNull(response);
        assertEquals("architecture,api", response.tags());
        assertTrue(response.isPinned());
        assertEquals("Architecture", response.folder());
    }

    @Test
    void testUpdatePaste_WithTagsAndPin() {
        when(pasteRepository.findById(1L)).thenReturn(Optional.of(paste));
        when(pasteRepository.save(any(Paste.class))).thenReturn(paste);

        PasteResponse response = pasteService.updatePaste(1L, new UpdatePasteRequest("Updated Title", "New Content", "backend", false, "Backend"));

        assertNotNull(response);
        verify(pasteRepository, times(1)).save(paste);
    }
}
